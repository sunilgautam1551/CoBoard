const NAME_KEY = 'coboard:name';
const COLOR_SEED_KEY = 'coboard:colorSeed';

/** Remembered across boards/sessions on this browser (no accounts in v1). */
export function loadStoredName(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(NAME_KEY);
}

export function storeName(name: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NAME_KEY, name);
}

/**
 * A stable per-browser id used only to derive a consistent avatar/cursor
 * color, independent of the per-session clientId — otherwise a person's
 * color would reshuffle every time they reopen the app, undermining the
 * "know who's who" point of having a color at all.
 */
export function loadOrCreateColorSeed(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const existing = window.localStorage.getItem(COLOR_SEED_KEY);
  if (existing) return existing;
  window.localStorage.setItem(COLOR_SEED_KEY, fallback);
  return fallback;
}
