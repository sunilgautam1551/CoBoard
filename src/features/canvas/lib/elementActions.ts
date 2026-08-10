import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';
import { newElementId } from '@/lib/utils';
import type { Element } from '@/types';
import { findBoundText } from './boundText';
import { getElementBounds } from './bounds';
import { translatePoints } from './transform';
import { setClipboard, getClipboard } from './clipboard';

/** Shared by the style panel, the right-click menu, and the Ctrl+D shortcut. */

export function duplicateSelectionAndBroadcast() {
  const clones = useBoardStore.getState().duplicateSelection();
  for (const el of clones) useSyncStore.getState().sendUpsert(el);
}

export function deleteSelectionAndBroadcast(ids: string[]) {
  if (ids.length === 0) return;
  const updatedAt = Date.now();
  const clientId = useBoardStore.getState().clientId;
  const deleted = useBoardStore.getState().deleteElements(ids);
  for (const id of deleted) useSyncStore.getState().sendDelete(id, updatedAt, clientId);
}

export function reorderSelectionAndBroadcast(direction: 'front' | 'back') {
  const changed = useBoardStore.getState().reorderSelection(direction);
  for (const el of changed) useSyncStore.getState().sendUpsert(el);
}

/** Ctrl/Cmd+C — snapshots the selection (plus any bound labels) into an in-app clipboard. */
export function copySelectionToClipboard(selectedIds: string[]) {
  if (selectedIds.length === 0) return;
  const elements = useBoardStore.getState().elements;
  const copied: Element[] = [];
  for (const id of selectedIds) {
    const el = elements[id];
    if (el) copied.push(el);
    const bound = findBoundText(elements, id);
    if (bound) copied.push(bound);
  }
  setClipboard(copied);
}

/**
 * Ctrl/Cmd+V — clones whatever's in the clipboard with fresh ids,
 * centered on `at` if given (e.g. the last known cursor position) or
 * offset like a duplicate otherwise, and selects the new copies.
 */
export function pasteClipboardAndBroadcast(at?: { x: number; y: number }) {
  const clip = getClipboard();
  if (clip.length === 0) return;

  let offsetX = 12;
  let offsetY = 12;
  const containers = clip.filter((el) => !el.containerId && el.x !== undefined);
  if (at && containers.length > 0) {
    const bounds = containers.map(getElementBounds);
    const minX = Math.min(...bounds.map((b) => b.x));
    const minY = Math.min(...bounds.map((b) => b.y));
    const maxX = Math.max(...bounds.map((b) => b.x + b.w));
    const maxY = Math.max(...bounds.map((b) => b.y + b.h));
    offsetX = at.x - (minX + maxX) / 2;
    offsetY = at.y - (minY + maxY) / 2;
  }

  const now = Date.now();
  const idMap: Record<string, string> = {};
  const clones: Element[] = [];

  for (const el of clip) {
    if (el.containerId) continue;
    const newId = newElementId();
    idMap[el.id] = newId;
    clones.push({
      ...el,
      id: newId,
      updatedAt: now,
      z: now + clones.length,
      x: el.x !== undefined ? el.x + offsetX : el.x,
      y: el.y !== undefined ? el.y + offsetY : el.y,
      points: el.points ? translatePoints(el.points, offsetX, offsetY) : el.points,
      // A pasted copy shouldn't stay silently glued to the original's binding.
      startBinding: undefined,
      endBinding: undefined,
    });
  }
  for (const el of clip) {
    if (!el.containerId) continue;
    const newContainerId = idMap[el.containerId];
    if (!newContainerId) continue;
    clones.push({ ...el, id: newElementId(), containerId: newContainerId, updatedAt: now, z: now + clones.length });
  }

  useBoardStore.getState().commitElements(clones);
  for (const el of clones) useSyncStore.getState().sendUpsert(el);
  useBoardStore.getState().setSelectedIds(clones.filter((c) => !c.containerId).map((c) => c.id));
}
