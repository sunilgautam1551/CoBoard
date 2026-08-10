import { create } from 'zustand';
import type { Presence } from '@/types';

interface PresenceState {
  /** Remote participants only — never includes the local client. */
  participants: Record<string, Presence>;
  /**
   * Merges a fresh roster from presence sync (clientId/name/color),
   * preserving each participant's last-known cursor position — cursor
   * updates arrive separately over broadcast, not presence (see
   * useRealtimeSync for why).
   */
  setParticipants: (participants: Record<string, Presence>) => void;
  updateCursor: (clientId: string, cursor: { x: number; y: number } | null) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  participants: {},

  setParticipants: (incoming) =>
    set((s) => {
      const next: Record<string, Presence> = {};
      for (const [id, p] of Object.entries(incoming)) {
        next[id] = { ...p, cursor: s.participants[id]?.cursor ?? null };
      }
      return { participants: next };
    }),

  updateCursor: (clientId, cursor) =>
    set((s) => {
      const existing = s.participants[clientId];
      if (!existing) return s;
      return { participants: { ...s.participants, [clientId]: { ...existing, cursor } } };
    }),

  clear: () => set({ participants: {} }),
}));
