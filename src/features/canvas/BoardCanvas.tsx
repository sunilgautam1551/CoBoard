'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import type { Element } from '@/types';
import { useSnapshotPersistence } from '@/features/board/hooks/useSnapshotPersistence';
import { useRealtimeSync } from '@/features/sync/useRealtimeSync';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { ZoomIndicator } from './ZoomIndicator';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

type Props = { boardId: string; initialElements: Element[] };

export function BoardCanvas({ boardId, initialElements }: Props) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const toggleShortcuts = useCallback(() => setShortcutsOpen((v) => !v), []);
  useKeyboardShortcuts(toggleShortcuts);

  const setBoardId = useBoardStore((s) => s.setBoardId);
  const loadSnapshot = useBoardStore((s) => s.loadSnapshot);
  const loadedBoardIdRef = useRef<string | null>(null);

  useEffect(() => {
    setBoardId(boardId);
    if (loadedBoardIdRef.current !== boardId) {
      loadedBoardIdRef.current = boardId;
      loadSnapshot(initialElements);
    }
  }, [boardId, initialElements, loadSnapshot, setBoardId]);

  useSnapshotPersistence(boardId);
  useRealtimeSync(boardId);

  return (
    <div className="flex h-dvh w-full flex-col">
      <header>
        <Toolbar onOpenShortcuts={() => setShortcutsOpen(true)} />
      </header>
      <main className="relative flex-1">
        <Canvas />
        <ZoomIndicator />
      </main>
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
