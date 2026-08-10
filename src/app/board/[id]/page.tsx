import { BoardPageClient } from '@/features/board/components/BoardPageClient';

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BoardPageClient boardId={id} />;
}
