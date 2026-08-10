import { create } from 'zustand';
import type { Presence } from '@/types';

interface PresenceState {
  /** Remote participants only — never includes the local client. */
  participants: Record<string, Presence>;
  /**
   * Cursor positions, keyed by clientId, independent of `participants`.
   *
   * These arrive over a different channel (broadcast) than identity
   * (presence sync), so they can — and regularly do — arrive out of
   * order: a cursor:move can land before the presence_diff that
   * introduces that clientId. Keeping them in the same map as identity
   * meant an early cursor update had nowhere to attach and was
   * silently dropped, which read as "their cursor doesn't show" or a
   * stale/laggy position once it did. Decoupled so nothing is lost.
   */
  cursors: Record<string, { x: number; y: number } | null>;
  setParticipants: (participants: Record<string, Presence>) => void;
  updateCursor: (clientId: string, cursor: { x: number; y: number } | null) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  participants: {},
  cursors: {},

  setParticipants: (participants) => set({ participants }),

  updateCursor: (clientId, cursor) =>
    set((s) => ({ cursors: { ...s.cursors, [clientId]: cursor } })),

  clear: () => set({ participants: {}, cursors: {} }),
}));
