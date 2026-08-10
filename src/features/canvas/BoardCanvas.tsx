'use client';

import { useEffect, useRef } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import type { Element } from '@/types';
import { useSnapshotPersistence } from '@/features/board/hooks/useSnapshotPersistence';
import { useRealtimeSync } from '@/features/sync/useRealtimeSync';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { ZoomIndicator } from './ZoomIndicator';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

type Props = { boardId: string; initialElements: Element[] };

export function BoardCanvas({ boardId, initialElements }: Props) {
  useKeyboardShortcuts();
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
      <Toolbar />
      <div className="relative flex-1">
        <Canvas />
        <ZoomIndicator />
      </div>
    </div>
  );
}
