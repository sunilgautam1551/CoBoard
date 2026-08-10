'use client';

import { useRef } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';
import type { Tool } from '@/types';
import { ShareButton } from '@/features/board/components/ShareButton';
import { AvatarStack } from '@/features/presence/AvatarStack';

const TOOLS: { tool: Tool; label: string; shortcut: string; icon: string }[] = [
  { tool: 'select', label: 'Select', shortcut: 'V', icon: '⟡' },
  { tool: 'pen', label: 'Pen', shortcut: 'P', icon: '✎' },
  { tool: 'rect', label: 'Rectangle', shortcut: 'R', icon: '▭' },
  { tool: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: '◯' },
  { tool: 'line', label: 'Line', shortcut: 'L', icon: '╱' },
  { tool: 'arrow', label: 'Arrow', shortcut: 'A', icon: '➜' },
  { tool: 'text', label: 'Text', shortcut: 'T', icon: 'T' },
  { tool: 'eraser', label: 'Eraser', shortcut: 'E', icon: '⌫' },
];

const SWATCHES = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];

type Props = { onOpenShortcuts: () => void };

export function Toolbar({ onOpenShortcuts }: Props) {
  const tool = useBoardStore((s) => s.tool);
  const setTool = useBoardStore((s) => s.setTool);
  const style = useBoardStore((s) => s.style);
  const setStyle = useBoardStore((s) => s.setStyle);
  const recentColors = useBoardStore((s) => s.recentColors);
  const addRecentColor = useBoardStore((s) => s.addRecentColor);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const canUndo = useBoardStore((s) => s.past.length > 0);
  const canRedo = useBoardStore((s) => s.future.length > 0);

  const toolButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleStrokeChange(color: string) {
    setStyle({ stroke: color });
    addRecentColor(color);
  }

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
      className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 shadow-sm"
    >
      <div
        className="flex items-center gap-1"
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
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
              tool === t
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span aria-hidden="true">{icon}</span>
          </button>
        ))}
      </div>

      <div className="mx-1 h-6 w-px shrink-0 bg-neutral-200" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Style">
        <label className="flex items-center gap-1 text-xs text-neutral-600">
          Stroke
          <input
            type="color"
            value={style.stroke}
            onChange={(e) => handleStrokeChange(e.target.value)}
            aria-label="Stroke color"
            className="h-7 w-7 cursor-pointer rounded border border-neutral-300"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-600">
          Fill
          <input
            type="color"
            value={style.fill === 'transparent' ? '#ffffff' : style.fill}
            onChange={(e) => setStyle({ fill: e.target.value })}
            aria-label="Fill color"
            className="h-7 w-7 cursor-pointer rounded border border-neutral-300"
          />
          <button
            type="button"
            onClick={() => setStyle({ fill: 'transparent' })}
            aria-pressed={style.fill === 'transparent'}
            className="ml-1 rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
          >
            None
          </button>
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-600">
          Width
          <input
            type="range"
            min={1}
            max={20}
            value={style.strokeWidth}
            onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })}
            aria-label="Stroke width"
            className="w-20 cursor-pointer"
          />
        </label>
        <div className="flex items-center gap-1" role="group" aria-label="Recent colors">
          {(recentColors.length ? recentColors : SWATCHES).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleStrokeChange(c)}
              aria-label={`Use color ${c}`}
              style={{ backgroundColor: c }}
              className="h-5 w-5 shrink-0 rounded-full border border-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
            />
          ))}
        </div>
      </div>

      <div className="mx-1 h-6 w-px shrink-0 bg-neutral-200" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="History">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo (Ctrl+Z)"
          title="Undo (Ctrl+Z)"
          className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo (Ctrl+Shift+Z)"
          title="Redo (Ctrl+Shift+Z)"
          className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          ↷
        </button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <AvatarStack />
        <ShareButton />
        <button
          type="button"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
          className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          ?
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Clear board
        </button>
      </div>
    </div>
  );
}
