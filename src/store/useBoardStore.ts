import { create } from 'zustand';
import type { Element, Tool } from '@/types';
import { newClientId, randomName, colorFromId } from '@/lib/utils';
import { loadStoredName, storeName, loadOrCreateColorSeed } from '@/lib/identity';
import { config } from '@/lib/config';
import { shouldApplyRemote } from '@/features/sync/lww';
import { useSyncStore } from '@/features/sync/useSyncStore';

export type ElementsMap = Record<string, Element>;

export type Style = { stroke: string; fill: string; strokeWidth: number; fontSize: number };

export type Viewport = { x: number; y: number; scale: number };

const DEFAULT_STYLE: Style = {
  stroke: '#1e1e1e',
  fill: 'transparent',
  strokeWidth: 3,
  fontSize: 20,
};

interface BoardState {
  clientId: string;
  name: string;
  color: string;
  boardId: string;
  elements: ElementsMap;
  selectedIds: string[];
  tool: Tool;
  style: Style;
  recentColors: string[];
  viewport: Viewport;

  past: ElementsMap[];
  future: ElementsMap[];

  setBoardId: (boardId: string) => void;
  /** Renames this client, persists it, and re-announces presence. */
  setName: (name: string) => void;
  /** Hydrates the store from a persisted snapshot, resetting history. */
  loadSnapshot: (elements: Element[]) => void;
  setTool: (tool: Tool) => void;
  setStyle: (style: Partial<Style>) => void;
  /**
   * Applies a style patch to every currently-selected element (in
   * addition to `setStyle` updating the default for new elements) —
   * without this, the style panel only ever affected shapes you
   * hadn't drawn yet, which read as "I can't recolor anything I
   * already made." fontSize only applies to text elements.
   */
  applyStyleToSelection: (style: Partial<Style>) => void;
  addRecentColor: (color: string) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setSelectedIds: (ids: string[]) => void;

  /** Push the current elements onto the undo stack and clear redo. */
  snapshotHistory: () => void;
  /** Transient update — no history entry (used mid-gesture: drag/draw). */
  applyElement: (element: Element) => void;
  /** Snapshot history, then apply — used at the end of a gesture. */
  commitElement: (element: Element) => void;
  deleteElements: (ids: string[]) => void;
  clearBoard: () => void;
  undo: () => void;
  redo: () => void;

  /** Applies a remote upsert if it wins the LWW check. No history entry. */
  mergeRemoteUpsert: (element: Element) => void;
  /** Applies a remote delete if it wins the LWW check. No history entry. */
  mergeRemoteDelete: (id: string, updatedAt: number, updatedBy: string) => void;
}

const clientId = newClientId();
const colorSeed = loadOrCreateColorSeed(clientId);

export const useBoardStore = create<BoardState>((set, get) => ({
  clientId,
  name: loadStoredName() ?? randomName(),
  color: colorFromId(colorSeed),
  boardId: '',
  elements: {},
  selectedIds: [],
  tool: 'select',
  style: DEFAULT_STYLE,
  recentColors: [],
  viewport: { x: 0, y: 0, scale: 1 },

  past: [],
  future: [],

  setBoardId: (boardId) => set({ boardId }),

  setName: (name) => {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    storeName(trimmed);
    set({ name: trimmed });
    useSyncStore.getState().retrackIdentity();
  },

  loadSnapshot: (elements) =>
    set({
      elements: Object.fromEntries(elements.map((el) => [el.id, el])),
      past: [],
      future: [],
      selectedIds: [],
    }),

  setTool: (tool) => set({ tool, selectedIds: tool === 'select' ? get().selectedIds : [] }),

  setStyle: (style) => set((s) => ({ style: { ...s.style, ...style } })),

  applyStyleToSelection: (patch) => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().snapshotHistory();
    set((s) => {
      const next = { ...s.elements };
      for (const id of selectedIds) {
        const el = next[id];
        if (!el) continue;
        const updated: Element = { ...el, updatedAt: Date.now() };
        if (patch.stroke !== undefined) updated.stroke = patch.stroke;
        if (patch.fill !== undefined) updated.fill = patch.fill;
        if (patch.strokeWidth !== undefined) updated.strokeWidth = patch.strokeWidth;
        if (patch.fontSize !== undefined && el.type === 'text') updated.fontSize = patch.fontSize;
        next[id] = updated;
      }
      return { elements: next };
    });
  },

  addRecentColor: (color) =>
    set((s) => ({
      recentColors: [color, ...s.recentColors.filter((c) => c !== color)].slice(
        0,
        8,
      ),
    })),

  setViewport: (viewport) => set((s) => ({ viewport: { ...s.viewport, ...viewport } })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  snapshotHistory: () =>
    set((s) => ({
      past: [...s.past, s.elements].slice(-config.undoStackLimit),
      future: [],
    })),

  applyElement: (element) =>
    set((s) => ({ elements: { ...s.elements, [element.id]: element } })),

  commitElement: (element) => {
    get().snapshotHistory();
    set((s) => ({ elements: { ...s.elements, [element.id]: element } }));
  },

  deleteElements: (ids) => {
    if (ids.length === 0) return;
    get().snapshotHistory();
    set((s) => {
      const next = { ...s.elements };
      for (const id of ids) delete next[id];
      return {
        elements: next,
        selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
      };
    });
  },

  clearBoard: () => {
    get().snapshotHistory();
    set({ elements: {}, selectedIds: [] });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [s.elements, ...s.future],
      elements: previous,
      selectedIds: [],
    }));
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const next = future[0];
    set((s) => ({
      past: [...s.past, s.elements],
      future: s.future.slice(1),
      elements: next,
      selectedIds: [],
    }));
  },

  mergeRemoteUpsert: (element) =>
    set((s) => {
      const local = s.elements[element.id];
      if (!shouldApplyRemote(element.updatedAt, element.updatedBy, local)) return s;
      return { elements: { ...s.elements, [element.id]: element } };
    }),

  mergeRemoteDelete: (id, updatedAt, updatedBy) =>
    set((s) => {
      const local = s.elements[id];
      if (!local || !shouldApplyRemote(updatedAt, updatedBy, local)) return s;
      const next = { ...s.elements };
      delete next[id];
      return { elements: next, selectedIds: s.selectedIds.filter((sid) => sid !== id) };
    }),
}));
