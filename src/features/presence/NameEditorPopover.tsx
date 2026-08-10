'use client';

import { useEffect, useRef, useState } from 'react';
import { useBoardStore } from '@/store/useBoardStore';

type Props = { onClose: () => void };

/**
 * Small popover, anchored under the user's own avatar, for editing
 * their display name. Closes on Escape, on a click outside itself, or
 * after a successful save; an empty/whitespace-only value is treated as
 * "cancel" rather than clearing the name entirely.
 */
export function NameEditorPopover({ onClose }: Props) {
  const name = useBoardStore((s) => s.name);
  const setName = useBoardStore((s) => s.setName);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  /** Commits the edited name (ignoring a blank value) and closes the popover. */
  function save() {
    if (value.trim()) setName(value);
    onClose();
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Edit your display name"
      className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg"
    >
      <label htmlFor="display-name-input" className="mb-1 block text-xs font-medium text-neutral-600">
        Your name
      </label>
      <input
        id="display-name-input"
        ref={inputRef}
        type="text"
        value={value}
        maxLength={40}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
        }}
        className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
        >
          Save
        </button>
      </div>
    </div>
  );
}
