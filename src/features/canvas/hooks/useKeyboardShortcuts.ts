import { useEffect } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import type { Tool } from '@/types';

const SHORTCUT_TOOLS: Record<string, Tool> = {
  v: 'select',
  p: 'pen',
  r: 'rect',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  t: 'text',
  e: 'eraser',
};

export function useKeyboardShortcuts() {
  const setTool = useBoardStore((s) => s.setTool);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod) return;

      const tool = SHORTCUT_TOOLS[e.key.toLowerCase()];
      if (tool) setTool(tool);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setTool, undo, redo]);
}
