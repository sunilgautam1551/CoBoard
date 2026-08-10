import { create } from 'zustand';
import type { Presence } from '@/types';

interface PresenceState {
  /** Remote participants only — never includes the local client. */
  participants: Record<string, Presence>;
  setParticipants: (participants: Record<string, Presence>) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  participants: {},
  setParticipants: (participants) => set({ participants }),
  clear: () => set({ participants: {} }),
}));
