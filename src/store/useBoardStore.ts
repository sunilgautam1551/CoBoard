import { create } from 'zustand';
import type { Element, Tool, StrokeStyle, Edges, FillStyle, TextAlign } from '@/types';
import { newClientId, randomName, colorFromId, newElementId } from '@/lib/utils';
import { loadStoredName, storeName, loadOrCreateColorSeed } from '@/lib/identity';
import { config } from '@/lib/config';
import { shouldApplyRemote } from '@/features/sync/lww';
import { useSyncStore } from '@/features/sync/useSyncStore';

export type ElementsMap = Record<string, Element>;

export type Style = {
  stroke: string;
  fill: string;
  strokeWidth: number;
  fontSize: number;
  roughness: number;
  strokeStyle: StrokeStyle;
  fillStyle: FillStyle;
  edges: Edges;
  opacity: number;
  textAlign: TextAlign;
};

export type Viewport = { x: number; y: number; scale: number };

const DEFAULT_STYLE: Style = {
  stroke: '#1e1e1e',
  fill: 'transparent',
  strokeWidth: 3,
  fontSize: 20,
  roughness: 1.4,
  strokeStyle: 'solid',
  fillStyle: 'solid',
  edges: 'round',
  opacity: 100,
  textAlign: 'left',
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

  /** Clones the selection with a small offset and selects the copies. Returns the new elements to broadcast. */
  duplicateSelection: () => Element[];
  /**
   * Moves selected elements to the front/back of the shared z-order and
   * bumps their updatedAt so the change wins LWW on every client. Returns
   * the changed elements to broadcast — a purely local key-order shuffle
   * wouldn't propagate, since each client rebuilds its own `elements` map
   * from its own arrival order of upserts.
   */
  reorderSelection: (direction: 'front' | 'back') => Element[];

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
        if (patch.roughness !== undefined) updated.roughness = patch.roughness;
        if (patch.strokeStyle !== undefined) updated.strokeStyle = patch.strokeStyle;
        if (patch.fillStyle !== undefined) updated.fillStyle = patch.fillStyle;
        if (patch.edges !== undefined) updated.edges = patch.edges;
        if (patch.opacity !== undefined) updated.opacity = patch.opacity;
        if (patch.textAlign !== undefined && el.type === 'text') updated.textAlign = patch.textAlign;
        next[id] = updated;
      }
      return { elements: next };
    });
  },

  duplicateSelection: () => {
    const { selectedIds, elements } = get();
    if (selectedIds.length === 0) return [];
    get().snapshotHistory();
    const offset = 12;
    const maxZ = Object.values(elements).reduce((m, el) => Math.max(m, el.z ?? el.updatedAt), 0);
    const clones: Element[] = [];
    set((s) => {
      const next = { ...s.elements };
      for (const id of selectedIds) {
        const el = s.elements[id];
        if (!el) continue;
        const now = Date.now();
        const clone: Element = {
          ...el,
          id: newElementId(),
          z: maxZ + 1 + clones.length,
          updatedAt: now,
          x: el.x !== undefined ? el.x + offset : el.x,
          y: el.y !== undefined ? el.y + offset : el.y,
          points: el.points?.map((p) => p + offset),
        };
        next[clone.id] = clone;
        clones.push(clone);
      }
      return { elements: next, selectedIds: clones.map((c) => c.id) };
    });
    return clones;
  },

  reorderSelection: (direction) => {
    const { selectedIds, elements } = get();
    if (selectedIds.length === 0) return [];
    get().snapshotHistory();
    const all = Object.values(elements);
    const zOf = (el: Element) => el.z ?? el.updatedAt;
    const selected = selectedIds.map((id) => elements[id]).filter((el): el is Element => Boolean(el));
    const updatedAt = Date.now();
    let changed: Element[];
    if (direction === 'front') {
      const maxZ = all.reduce((m, el) => Math.max(m, zOf(el)), 0);
      changed = selected.map((el, i) => ({ ...el, z: maxZ + 1 + i, updatedAt }));
    } else {
      const minZ = all.reduce((m, el) => Math.min(m, zOf(el)), 0);
      changed = selected.map((el, i) => ({ ...el, z: minZ - selected.length + i, updatedAt }));
    }
    set((s) => {
      const next = { ...s.elements };
      for (const el of changed) next[el.id] = el;
      return { elements: next };
    });
    return changed;
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
