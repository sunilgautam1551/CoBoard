'use client';

import { useRef } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';
import type { Tool } from '@/types';
import { ShareButton } from '@/features/board/components/ShareButton';
import { AvatarStack } from '@/features/presence/AvatarStack';

const TOOLS: { tool: Tool; label: string; shortcut: string; icon: string }[] = [
  { tool: 'select', label: 'Select', shortcut: 'V', icon: '⟡' },
  { tool: 'hand', label: 'Hand (pan)', shortcut: 'H', icon: '✋︎' },
  { tool: 'pen', label: 'Pen', shortcut: 'P', icon: '✎' },
  { tool: 'rect', label: 'Rectangle', shortcut: 'R', icon: '▭' },
  { tool: 'diamond', label: 'Diamond', shortcut: 'D', icon: '◆' },
  { tool: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: '◯' },
  { tool: 'line', label: 'Line', shortcut: 'L', icon: '╱' },
  { tool: 'arrow', label: 'Arrow', shortcut: 'A', icon: '➜' },
  { tool: 'text', label: 'Text', shortcut: 'T', icon: 'T' },
  { tool: 'eraser', label: 'Eraser', shortcut: 'E', icon: '⌫' },
];

type Props = { onOpenShortcuts: () => void };

export function Toolbar({ onOpenShortcuts }: Props) {
  const tool = useBoardStore((s) => s.tool);
  const setTool = useBoardStore((s) => s.setTool);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const canUndo = useBoardStore((s) => s.past.length > 0);
  const canRedo = useBoardStore((s) => s.future.length > 0);

  const toolButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleClear() {
    if (window.confirm('Clear the entire board? This cannot be undone.')) {
      const { elements, clientId } = useBoardStore.getState();
      const ids = Object.keys(elements);
      const updatedAt = Date.now();
      clearBoard();
      for (const id of ids) {
        useSyncStore.getState().sendDelete(id, updatedAt, clientId);
      }
    }
  }

  // Roving tabindex (WAI-ARIA toolbar pattern): only the active tool is
  // tab-stoppable; arrow keys move focus between the others.
  function handleToolsKeyDown(e: React.KeyboardEvent) {
    const currentIndex = TOOLS.findIndex((t) => t.tool === tool);
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % TOOLS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + TOOLS.length) % TOOLS.length;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      toolButtonRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-neutral-200/80 bg-white/95 px-2.5 py-2 shadow-lg shadow-neutral-900/5 backdrop-blur"
    >
      <div
        className="flex flex-wrap items-center gap-0.5"
        role="group"
        aria-label="Tools"
        onKeyDown={handleToolsKeyDown}
      >
        {TOOLS.map(({ tool: t, label, shortcut, icon }, index) => (
          <button
            key={t}
            ref={(el) => {
              toolButtonRefs.current[index] = el;
            }}
            type="button"
            onClick={() => setTool(t)}
            aria-label={`${label} (${shortcut})`}
            aria-pressed={tool === t}
            title={`${label} (${shortcut})`}
            tabIndex={tool === t ? 0 : -1}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
              tool === t
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <span aria-hidden="true">{icon}</span>
          </button>
        ))}
      </div>

      <div className="mx-0.5 h-6 w-px shrink-0 bg-neutral-200" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label="History">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo (Ctrl+Z)"
          title="Undo (Ctrl+Z)"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo (Ctrl+Shift+Z)"
          title="Redo (Ctrl+Shift+Z)"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          ↷
        </button>
      </div>

      <div className="mx-0.5 h-6 w-px shrink-0 bg-neutral-200" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-2">
        <AvatarStack />
        <ShareButton />
        <button
          type="button"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          ?
        </button>
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear board"
          title="Clear board"
          className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
