/**
 * Next.js route-level fallback shown while `page.tsx`'s async board
 * fetch is in flight — most relevant when the Supabase project has spun
 * down after inactivity and the first query pays a cold-start cost.
 */
export default function BoardLoading() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="text-sm text-neutral-500">
        Waking up your board — this can take up to 30 seconds if it&apos;s
        been idle for a while.
      </p>
    </div>
  );
}
