import { BoardPageClient } from '@/features/board/components/BoardPageClient';
import { getBoardSnapshot } from '@/features/board/data/getBoardSnapshot';

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialElements = await getBoardSnapshot(id);
  return <BoardPageClient boardId={id} initialElements={initialElements} />;
}
