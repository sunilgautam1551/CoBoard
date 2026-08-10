import { create } from 'zustand';
import type { Element } from '@/types';

/**
 * A small imperative bus exposing the active channel's send functions,
 * so gesture handlers in Canvas.tsx can broadcast without prop-drilling
 * the channel through the component tree. Not meant to be subscribed to
 * for rendering — read via `useSyncStore.getState()` at call time.
 */
type SyncBus = {
  connected: boolean;
  sendUpsert: (element: Element) => void;
  sendUpsertThrottled: (element: Element) => void;
  sendDelete: (id: string, updatedAt: number, updatedBy: string) => void;
  /** Throttled presence cursor update (PRD §7.4/§7.5). */
  updateCursor: (x: number, y: number) => void;
  /** Immediately marks this client's cursor as off-canvas. */
  clearCursor: () => void;
};

const noop = () => {};

export const useSyncStore = create<SyncBus>(() => ({
  connected: false,
  sendUpsert: noop,
  sendUpsertThrottled: noop,
  sendDelete: noop,
  updateCursor: noop,
  clearCursor: noop,
}));
