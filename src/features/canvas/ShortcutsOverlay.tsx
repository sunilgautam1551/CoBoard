'use client';

import { useEffect, useRef } from 'react';

const SHORTCUTS: [string, string][] = [
  ['V', 'Select'],
  ['P', 'Pen'],
  ['R', 'Rectangle'],
  ['O', 'Ellipse'],
  ['L', 'Line'],
  ['A', 'Arrow'],
  ['T', 'Text'],
  ['E', 'Eraser'],
  ['Delete / Backspace', 'Delete selection'],
  ['Shift + click', 'Add to selection'],
  ['Space + drag', 'Pan canvas'],
  ['Middle-mouse drag', 'Pan canvas'],
  ['Scroll / pinch', 'Zoom'],
  ['Ctrl/Cmd + Z', 'Undo'],
  ['Ctrl/Cmd + Shift + Z', 'Redo'],
  ['?', 'Toggle this panel'],
];

type Props = { open: boolean; onClose: () => void };

export function ShortcutsOverlay({ open, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-sm font-semibold text-neutral-900">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts panel"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            ×
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt className="whitespace-nowrap rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700">
                {key}
              </dt>
              <dd className="text-neutral-600">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
