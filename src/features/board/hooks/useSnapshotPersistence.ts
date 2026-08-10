'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useBoardStore } from '@/store/useBoardStore';
import { useToastStore } from '@/store/useToastStore';
import { config } from '@/lib/config';

/**
 * Debounced full-board snapshot save (PRD §7.6): on any local change,
 * wait ~1s of quiet, then upsert the whole elements array to Postgres.
 */
export function useSnapshotPersistence(boardId: string) {
  const elements = useBoardStore((s) => s.elements);
  const addToast = useToastStore((s) => s.addToast);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skippedInitialRun = useRef(false);
  const hasErroredRef = useRef(false);

  useEffect(() => {
    if (!boardId) return;

    // The first run reflects the snapshot we just hydrated from — no
    // need to write it straight back.
    if (!skippedInitialRun.current) {
      skippedInitialRun.current = true;
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('boards')
        .upsert({ id: boardId, snapshot: Object.values(elements), updated_at: new Date().toISOString() });

      if (error && !hasErroredRef.current) {
        hasErroredRef.current = true;
        addToast('Having trouble saving — your edits are kept locally and will retry.', 'error');
      } else if (!error) {
        hasErroredRef.current = false;
      }
    }, config.snapshotDebounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [elements, boardId, addToast]);
}
