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
type CursorPayload = { clientId: string; cursor: { x: number; y: number } | null };
type BufferedOp = { kind: 'upsert'; payload: UpsertPayload } | { kind: 'delete'; payload: DeletePayload };

// What gets `track()`ed via Presence: identity only. Cursor position is
// NOT included — see the comment above the 'system' error handler below
// for why sending it via presence.track() is actively dangerous.
type PresenceIdentity = Omit<Presence, 'cursor'>;

/**
 * Subscribes to `board:{boardId}` and wires broadcast events into the
 * store's LWW merge (PRD §7), tracks presence for this client, and
 * re-hydrates from the latest snapshot after a reconnect.
 */
export function useRealtimeSync(boardId: string) {
  const mergeRemoteUpsert = useBoardStore((s) => s.mergeRemoteUpsert);
  const mergeRemoteDelete = useBoardStore((s) => s.mergeRemoteDelete);

  useEffect(() => {
    if (!boardId) return;

    const { clientId, name, color } = useBoardStore.getState();
    let disposed = false;
    let activeChannel: RealtimeChannel | null = null;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    // Ops that arrive before local hydration finishes are buffered and
    // replayed after (PRD §7.6).
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

    function connect() {
      if (disposed) return;

      const channel: RealtimeChannel = supabase.channel(`board:${boardId}`, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: clientId },
        },
      });
      activeChannel = channel;

      channel.on('broadcast', { event: 'element:upsert' }, (message) => {
        handleUpsert(message.payload as UpsertPayload);
      });
      channel.on('broadcast', { event: 'element:delete' }, (message) => {
        handleDelete(message.payload as DeletePayload);
      });

      // Cursor position rides broadcast, not presence — see below.
      channel.on('broadcast', { event: 'cursor:move' }, (message) => {
        const payload = message.payload as CursorPayload;
        if (payload.clientId === clientId) return;
        usePresenceStore.getState().updateCursor(payload.clientId, payload.cursor);
      });

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceIdentity>();
        const participants: Record<string, Presence> = {};
        for (const key of Object.keys(state)) {
          if (key === clientId) continue; // never include ourselves
          const entry = state[key][0];
          if (entry) participants[key] = { ...entry, cursor: null };
        }
        usePresenceStore.getState().setParticipants(participants);
      });

      // Supabase Realtime enforces a separate, much stricter rate limit
      // specifically on presence.track() calls ("Client presence rate
      // limit exceeded") and force-closes the channel when it's hit —
      // confirmed live: this tripped even at a 150ms cursor-tracking
      // throttle under completely normal mouse movement, while
      // broadcast messages at the same frequency never did. So cursor
      // position is sent via broadcast (like element ops) instead of
      // presence.track(); presence now only tracks identity once per
      // (re)connect, which stays far under any reasonable limit.
      //
      // Kept as a safety net regardless: if this class of error ever
      // fires anyway, tear down and rejoin with backoff rather than
      // leaving sync silently dead for the session. Immediate retry
      // was tried first and looped forever (retripping the same
      // window) — exponential backoff, one toast per retry series.
      channel.on('system', {}, (payload) => {
        if (payload.status !== 'error') return;
        console.warn('[sync] realtime system error, will rejoin channel:', payload.message);
        supabase.removeChannel(channel);
        if (activeChannel === channel) activeChannel = null;
        if (disposed) return;

        reconnectAttempts += 1;
        if (reconnectAttempts === 1) {
          useToastStore.getState().addToast('Sync hiccup — reconnecting…', 'error');
        }
        const delay = Math.min(
          config.reconnectBaseDelayMs * 2 ** (reconnectAttempts - 1),
          config.reconnectMaxDelayMs,
        );
        reconnectTimeout = setTimeout(connect, delay);
      });

      function send(
        event: 'element:upsert' | 'element:delete' | 'cursor:move',
        payload: UpsertPayload | DeletePayload | CursorPayload,
      ) {
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
      const sendCursor = (cursor: { x: number; y: number } | null) =>
        send('cursor:move', { clientId, cursor });
      const updateCursorThrottled = throttle((x: number, y: number) => {
        if (lastCursor && lastCursor.x === x && lastCursor.y === y) return;
        lastCursor = { x, y };
        sendCursor({ x, y });
      }, config.cursorThrottleMs);

      let hasSubscribedOnce = false;
      channel.subscribe(async (status) => {
        useSyncStore.setState({ connected: status === 'SUBSCRIBED' });

        if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0;
          channel.track({ clientId, name, color } satisfies PresenceIdentity);

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

          useSyncStore.setState({
            sendUpsert: sendUpsertRaw,
            sendUpsertThrottled,
            sendDelete,
            updateCursor: updateCursorThrottled,
            clearCursor: () => {
              lastCursor = null;
              sendCursor(null);
            },
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          useToastStore.getState().addToast('Connection lost — reconnecting…', 'error');
        }
      });

      ready = true;
      for (const op of buffer.splice(0)) {
        if (op.kind === 'upsert') mergeRemoteUpsert(op.payload.element);
        else mergeRemoteDelete(op.payload.id, op.payload.updatedAt, op.payload.updatedBy);
      }
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      usePresenceStore.getState().clear();
      useSyncStore.setState({
        connected: false,
        sendUpsert: () => {},
        sendUpsertThrottled: () => {},
        sendDelete: () => {},
        updateCursor: () => {},
        clearCursor: () => {},
      });
      if (activeChannel) supabase.removeChannel(activeChannel);
    };
  }, [boardId, mergeRemoteUpsert, mergeRemoteDelete]);
}
