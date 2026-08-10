'use client';

import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useBoardStore } from '@/store/useBoardStore';
import { usePresenceStore } from '@/features/presence/usePresenceStore';
import { useToastStore } from '@/store/useToastStore';
import { useSyncStore } from './useSyncStore';
import { throttle } from '@/lib/throttle';
import { config } from '@/lib/config';
import type { Element, Presence } from '@/types';

type UpsertPayload = { element: Element };
type DeletePayload = { id: string; updatedAt: number; updatedBy: string };
type BufferedOp = { kind: 'upsert'; payload: UpsertPayload } | { kind: 'delete'; payload: DeletePayload };

/**
 * Subscribes to `board:{boardId}` and wires broadcast events into the
 * store's LWW merge (PRD §7), tracks presence/cursor for this client,
 * and re-hydrates from the latest snapshot after a reconnect.
 */
export function useRealtimeSync(boardId: string) {
  const mergeRemoteUpsert = useBoardStore((s) => s.mergeRemoteUpsert);
  const mergeRemoteDelete = useBoardStore((s) => s.mergeRemoteDelete);

  useEffect(() => {
    if (!boardId) return;

    const { clientId, name, color } = useBoardStore.getState();

    let ready = false;
    const buffer: BufferedOp[] = [];

    function handleUpsert(payload: UpsertPayload) {
      if (!ready) {
        buffer.push({ kind: 'upsert', payload });
        return;
      }
      mergeRemoteUpsert(payload.element);
    }

    function handleDelete(payload: DeletePayload) {
      if (!ready) {
        buffer.push({ kind: 'delete', payload });
        return;
      }
      mergeRemoteDelete(payload.id, payload.updatedAt, payload.updatedBy);
    }

    const channel: RealtimeChannel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: clientId },
      },
    });

    channel.on('broadcast', { event: 'element:upsert' }, (message) => {
      handleUpsert(message.payload as UpsertPayload);
    });
    channel.on('broadcast', { event: 'element:delete' }, (message) => {
      handleDelete(message.payload as DeletePayload);
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<Presence>();
      const participants: Record<string, Presence> = {};
      for (const key of Object.keys(state)) {
        if (key === clientId) continue; // never include ourselves
        const entry = state[key][0];
        if (entry) participants[key] = entry;
      }
      usePresenceStore.getState().setParticipants(participants);
    });

    function send(event: 'element:upsert' | 'element:delete', payload: UpsertPayload | DeletePayload) {
      const size = new Blob([JSON.stringify(payload)]).size;
      if (size > config.maxMessageBytes) {
        console.warn(`[sync] dropped ${event}: payload is ${size} bytes (max ${config.maxMessageBytes})`);
        return;
      }
      channel.send({ type: 'broadcast', event, payload });
    }

    const sendUpsertRaw = (element: Element) => send('element:upsert', { element });
    const sendUpsertThrottled = throttle(sendUpsertRaw, config.dragThrottleMs);
    const sendDelete = (id: string, updatedAt: number, updatedBy: string) =>
      send('element:delete', { id, updatedAt, updatedBy });

    let lastCursor: { x: number; y: number } | null = null;
    const trackCursorRaw = (cursor: { x: number; y: number } | null) => {
      channel.track({ clientId, name, color, cursor } satisfies Presence);
    };
    const updateCursorThrottled = throttle((x: number, y: number) => {
      if (lastCursor && lastCursor.x === x && lastCursor.y === y) return;
      lastCursor = { x, y };
      trackCursorRaw({ x, y });
    }, config.cursorThrottleMs);

    let hasSubscribedOnce = false;
    channel.subscribe(async (status) => {
      useSyncStore.setState({ connected: status === 'SUBSCRIBED' });

      if (status === 'SUBSCRIBED') {
        trackCursorRaw(null);

        if (hasSubscribedOnce) {
          // Reconnected after a drop — re-hydrate from the latest
          // snapshot in case ops were missed while offline (PRD §9/§10).
          const { data } = await supabase
            .from('boards')
            .select('snapshot')
            .eq('id', boardId)
            .maybeSingle();
          const snapshot = (data?.snapshot as Element[] | undefined) ?? [];
          for (const element of snapshot) mergeRemoteUpsert(element);
          useToastStore.getState().addToast('Reconnected — back in sync.', 'success');
        }
        hasSubscribedOnce = true;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        useToastStore.getState().addToast('Connection lost — reconnecting…', 'error');
      }
    });

    // Local hydration (from SSR/loadSnapshot props) is synchronous and
    // has already run by the time this effect fires, so it's safe to
    // flip ready here — the buffer only protects against pathological
    // ordering (e.g. a fast reconnect racing a re-render).
    ready = true;
    for (const op of buffer.splice(0)) {
      if (op.kind === 'upsert') mergeRemoteUpsert(op.payload.element);
      else mergeRemoteDelete(op.payload.id, op.payload.updatedAt, op.payload.updatedBy);
    }

    useSyncStore.setState({
      sendUpsert: sendUpsertRaw,
      sendUpsertThrottled,
      sendDelete,
      updateCursor: updateCursorThrottled,
      clearCursor: () => {
        lastCursor = null;
        trackCursorRaw(null);
      },
    });

    return () => {
      sendUpsertThrottled.cancel();
      updateCursorThrottled.cancel();
      usePresenceStore.getState().clear();
      useSyncStore.setState({
        connected: false,
        sendUpsert: () => {},
        sendUpsertThrottled: () => {},
        sendDelete: () => {},
        updateCursor: () => {},
        clearCursor: () => {},
      });
      supabase.removeChannel(channel);
    };
  }, [boardId, mergeRemoteUpsert, mergeRemoteDelete]);
}
