'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { newBoardId } from '@/lib/utils';

/** Creates a new board row and returns its id. */
export async function createBoard(): Promise<string> {
  const id = newBoardId();
  const supabase = getServerSupabase();

  const { error } = await supabase.from('boards').insert({ id, snapshot: [] });
  if (error) {
    throw new Error(`Failed to create board: ${error.message}`);
  }

  return id;
}
