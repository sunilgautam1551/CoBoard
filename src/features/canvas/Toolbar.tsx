'use client';

import { useRef } from 'react';
import { useBoardStore, type Style } from '@/store/useBoardStore';
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

const SWATCHES = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
const FONT_SIZES: { label: string; value: number }[] = [
  { label: 'S', value: 16 },
  { label: 'M', value: 20 },
  { label: 'L', value: 28 },
  { label: 'XL', value: 36 },
];

type Props = { onOpenShortcuts: () => void };

export function Toolbar({ onOpenShortcuts }: Props) {
  const tool = useBoardStore((s) => s.tool);
  const setTool = useBoardStore((s) => s.setTool);
  const style = useBoardStore((s) => s.style);
  const setStyle = useBoardStore((s) => s.setStyle);
  const applyStyleToSelection = useBoardStore((s) => s.applyStyleToSelection);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const elements = useBoardStore((s) => s.elements);
  const recentColors = useBoardStore((s) => s.recentColors);
  const addRecentColor = useBoardStore((s) => s.addRecentColor);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const canUndo = useBoardStore((s) => s.past.length > 0);
  const canRedo = useBoardStore((s) => s.future.length > 0);

  const toolButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Updates the default style for new elements AND, if something is
  // already selected, restyles it live and broadcasts the change —
  // otherwise the style panel only ever affected shapes you hadn't
  // drawn yet.
  function applyAndBroadcast(patch: Partial<Style>) {
    setStyle(patch);
    const ids = useBoardStore.getState().selectedIds;
    if (ids.length === 0) return;
    applyStyleToSelection(patch);
    const updated = useBoardStore.getState().elements;
    for (const id of ids) {
      const el = updated[id];
      if (el) useSyncStore.getState().sendUpsert(el);
    }
  }

  function handleStrokeChange(color: string) {
    applyAndBroadcast({ stroke: color });
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

  const showFontSize =
    tool === 'text' || selectedIds.some((id) => elements[id]?.type === 'text');
  const activeFontSize =
    selectedIds.map((id) => elements[id]).find((el) => el?.type === 'text')?.fontSize ??
    style.fontSize;

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

      <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-neutral-50 px-2.5 py-1.5" role="group" aria-label="Style">
        <label className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="sr-only">Stroke</span>
          <input
            type="color"
            value={style.stroke}
            onChange={(e) => handleStrokeChange(e.target.value)}
            aria-label="Stroke color"
            title="Stroke color"
            className="h-6 w-6 cursor-pointer rounded-md border border-neutral-300"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="sr-only">Fill</span>
          <input
            type="color"
            value={style.fill === 'transparent' ? '#ffffff' : style.fill}
            onChange={(e) => applyAndBroadcast({ fill: e.target.value })}
            aria-label="Fill color"
            title="Fill color"
            className="h-6 w-6 cursor-pointer rounded-md border border-neutral-300"
          />
          <button
            type="button"
            onClick={() => applyAndBroadcast({ fill: 'transparent' })}
            aria-pressed={style.fill === 'transparent'}
            title="No fill"
            className={`rounded-md border px-1.5 py-0.5 text-[10px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
              style.fill === 'transparent'
                ? 'border-violet-300 bg-violet-100 text-violet-700'
                : 'border-neutral-300 text-neutral-500 hover:bg-white'
            }`}
          >
            None
          </button>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="sr-only">Width</span>
          <input
            type="range"
            min={1}
            max={20}
            value={style.strokeWidth}
            onChange={(e) => applyAndBroadcast({ strokeWidth: Number(e.target.value) })}
            aria-label="Stroke width"
            title="Stroke width"
            className="w-16 cursor-pointer accent-violet-600"
          />
        </label>
        {showFontSize && (
          <div className="flex items-center gap-0.5" role="group" aria-label="Font size">
            {FONT_SIZES.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => applyAndBroadcast({ fontSize: value })}
                aria-pressed={activeFontSize === value}
                aria-label={`Font size: ${label}`}
                title={`Font size: ${label}`}
                className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                  activeFontSize === value
                    ? 'bg-violet-600 text-white'
                    : 'text-neutral-500 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Recent colors">
          {(recentColors.length ? recentColors : SWATCHES).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleStrokeChange(c)}
              aria-label={`Use color ${c}`}
              style={{ backgroundColor: c }}
              className={`h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-black/10 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                style.stroke === c ? 'ring-2 ring-violet-500' : ''
              }`}
            />
          ))}
        </div>
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
