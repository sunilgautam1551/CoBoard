import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Vercel Cron pings this every 3 days (see vercel.json) to touch the
 * Supabase project and prevent the free-tier 7-day inactivity pause
 * (PRD §14.1). Guarded by CRON_SECRET — Vercel Cron sends it as a
 * Bearer token automatically when the env var is set.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.from('boards').select('id').limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
