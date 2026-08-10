'use client';

import { useEffect } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { ZoomIndicator } from './ZoomIndicator';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export function BoardCanvas({ boardId }: { boardId: string }) {
  useKeyboardShortcuts();
  const setBoardId = useBoardStore((s) => s.setBoardId);

  useEffect(() => {
    setBoardId(boardId);
  }, [boardId, setBoardId]);

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
