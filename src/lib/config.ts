/**
 * All tunables in one place, per PRD §7.4 / §11: throttle/debounce
 * intervals, zoom limits, and other budget-relevant constants.
 */

export const config = {
  // Realtime message-budget discipline (PRD §7.4)
  //
  // Cursor position is sent via broadcast, not presence.track() — see
  // useRealtimeSync.ts. Verified live: presence.track() has a much
  // stricter, separate server-side rate limit that broadcast doesn't,
  // so the PRD's ~50ms target is safe here.
  cursorThrottleMs: 50,
  strokeFlushMs: 50,
  dragThrottleMs: 50,
  maxMessageBytes: 256 * 1024, // 256 KB hard cap enforced by Supabase Realtime

  // Persistence
  snapshotDebounceMs: 1000,

  // Canvas
  zoomMin: 0.1,
  zoomMax: 8,
  zoomStep: 1.05,
  maxElementsWarning: 5000,

  // History
  undoStackLimit: 100,

  // Presence
  presenceHeartbeatMs: 15000,

  // Reconnect
  reconnectBaseDelayMs: 1000,
  reconnectMaxDelayMs: 15000,
} as const;
