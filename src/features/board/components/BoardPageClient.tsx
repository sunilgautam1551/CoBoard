'use client';

import dynamic from 'next/dynamic';

const BoardCanvas = dynamic(
  () => import('@/features/canvas/BoardCanvas').then((m) => m.BoardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center text-sm text-neutral-500">
        Loading board…
      </div>
    ),
  },
);

export function BoardPageClient({ boardId }: { boardId: string }) {
  return <BoardCanvas boardId={boardId} />;
}
