'use client';

import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from './useSyncStore';
import { throttle } from '@/lib/throttle';
import { config } from '@/lib/config';
import type { Element } from '@/types';

type UpsertPayload = { element: Element };
type DeletePayload = { id: string; updatedAt: number; updatedBy: string };
type BufferedOp = { kind: 'upsert'; payload: UpsertPayload } | { kind: 'delete'; payload: DeletePayload };

/**
 * Subscribes to `board:{boardId}` and wires broadcast events into the
 * store's LWW merge (PRD §7). Ops that arrive before local hydration
 * finishes are buffered and replayed after (§7.6).
 */
export function useRealtimeSync(boardId: string) {
  const mergeRemoteUpsert = useBoardStore((s) => s.mergeRemoteUpsert);
  const mergeRemoteDelete = useBoardStore((s) => s.mergeRemoteDelete);

  useEffect(() => {
    if (!boardId) return;

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
      config: { broadcast: { self: false, ack: false } },
    });

    channel.on('broadcast', { event: 'element:upsert' }, (message) => {
      handleUpsert(message.payload as UpsertPayload);
    });
    channel.on('broadcast', { event: 'element:delete' }, (message) => {
      handleDelete(message.payload as DeletePayload);
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

    channel.subscribe((status) => {
      useSyncStore.setState({ connected: status === 'SUBSCRIBED' });
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

    useSyncStore.setState({ sendUpsert: sendUpsertRaw, sendUpsertThrottled, sendDelete });

    return () => {
      sendUpsertThrottled.cancel();
      useSyncStore.setState({
        connected: false,
        sendUpsert: () => {},
        sendUpsertThrottled: () => {},
        sendDelete: () => {},
      });
      supabase.removeChannel(channel);
    };
  }, [boardId, mergeRemoteUpsert, mergeRemoteDelete]);
}
