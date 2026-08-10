/**
 * All tunables in one place, per PRD §7.4 / §11: throttle/debounce
 * intervals, zoom limits, and other budget-relevant constants.
 */

export const config = {
  // Realtime message-budget discipline (PRD §7.4)
  //
  // cursorThrottleMs is higher than the ~50ms the PRD suggests: at 50ms,
  // Supabase Realtime's server-side "presence rate limit" trips during
  // normal fast drawing (each pointermove tracks a new cursor position),
  // and the server force-closes the channel with no client-side recovery
  // — killing sync for that client. Verified against a live project;
  // 150ms stays well under the limit while still reading as live.
  cursorThrottleMs: 150,
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
