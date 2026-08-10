import { getServerSupabase } from '@/lib/supabase/server';
import type { Element } from '@/types';

/** Server-side snapshot load for SSR hydration (PRD §7.6). */
export async function getBoardSnapshot(id: string): Promise<Element[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('boards')
    .select('snapshot')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to load board snapshot:', error.message);
    return [];
  }

  return (data?.snapshot as Element[] | undefined) ?? [];
}
