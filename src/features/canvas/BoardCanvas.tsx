'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import type { Element } from '@/types';
import { useSnapshotPersistence } from '@/features/board/hooks/useSnapshotPersistence';
import { useRealtimeSync } from '@/features/sync/useRealtimeSync';
import { Toolbar } from './Toolbar';
import { StylePanel } from './StylePanel';
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

  // The style panel sits below the toolbar, whose height varies (it can
  // wrap to 2-3 rows on narrow screens) — measuring it directly avoids
  // guessing a fixed offset that overlaps on some viewport width.
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(64);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-dvh w-full">
      <main className="absolute inset-0">
        <Canvas />
        <ZoomIndicator />
      </main>
      <header
        ref={headerRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-3 pt-3"
      >
        <Toolbar onOpenShortcuts={() => setShortcutsOpen(true)} />
      </header>
      <aside
        style={{ top: headerHeight + 12 }}
        className="pointer-events-none absolute bottom-0 left-0 z-10 flex items-start overflow-hidden px-3 pb-3"
      >
        <StylePanel />
      </aside>
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
