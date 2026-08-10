'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { config } from '@/lib/config';

/**
 * Bottom-right zoom control: -/+ buttons that step the viewport scale
 * by `config.zoomStep`, and a percentage readout that doubles as a
 * "reset to 100%, re-center the origin" button.
 */
export function ZoomIndicator() {
  const scale = useBoardStore((s) => s.viewport.scale);
  const setViewport = useBoardStore((s) => s.setViewport);

  /** Multiplies the current zoom by `factor`, clamped to the configured min/max. */
  function zoomBy(factor: number) {
    const next = Math.min(config.zoomMax, Math.max(config.zoomMin, scale * factor));
    setViewport({ scale: next });
  }

  /** Returns the viewport to 100% zoom at the board's origin. */
  function reset() {
    setViewport({ x: 0, y: 0, scale: 1 });
  }

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-0.5 rounded-2xl border border-neutral-200/80 bg-white/95 px-1 py-1 text-xs shadow-lg shadow-neutral-900/5 backdrop-blur">
      <button
        type="button"
        onClick={() => zoomBy(1 / config.zoomStep)}
        aria-label="Zoom out"
        className="flex h-7 w-7 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        −
      </button>
      <button
        type="button"
        onClick={reset}
        aria-label="Reset zoom to 100%"
        className="min-w-[3.5rem] rounded-xl px-1 py-1 text-center tabular-nums text-neutral-700 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        type="button"
        onClick={() => zoomBy(config.zoomStep)}
        aria-label="Zoom in"
        className="flex h-7 w-7 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        +
      </button>
    </div>
  );
}
