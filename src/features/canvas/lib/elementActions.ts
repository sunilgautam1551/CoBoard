import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';

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
