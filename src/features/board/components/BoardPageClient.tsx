'use client';

import dynamic from 'next/dynamic';
import type { Element } from '@/types';

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

type Props = { boardId: string; initialElements: Element[] };

export function BoardPageClient({ boardId, initialElements }: Props) {
  return <BoardCanvas boardId={boardId} initialElements={initialElements} />;
}
