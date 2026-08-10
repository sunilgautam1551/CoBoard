'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { config } from '@/lib/config';

export function ZoomIndicator() {
  const scale = useBoardStore((s) => s.viewport.scale);
  const setViewport = useBoardStore((s) => s.setViewport);

  function zoomBy(factor: number) {
    const next = Math.min(config.zoomMax, Math.max(config.zoomMin, scale * factor));
    setViewport({ scale: next });
  }

  function reset() {
    setViewport({ x: 0, y: 0, scale: 1 });
  }

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1 py-1 text-xs shadow-sm">
      <button
        type="button"
        onClick={() => zoomBy(1 / config.zoomStep)}
        aria-label="Zoom out"
        className="flex h-7 w-7 items-center justify-center rounded hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        −
      </button>
      <button
        type="button"
        onClick={reset}
        aria-label="Reset zoom to 100%"
        className="min-w-[3.5rem] rounded px-1 py-1 text-center tabular-nums hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        type="button"
        onClick={() => zoomBy(config.zoomStep)}
        aria-label="Zoom in"
        className="flex h-7 w-7 items-center justify-center rounded hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        +
      </button>
    </div>
  );
}
