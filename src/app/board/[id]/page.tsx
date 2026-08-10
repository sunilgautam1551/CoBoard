import { BoardPageClient } from '@/features/board/components/BoardPageClient';
import { getBoardSnapshot } from '@/features/board/data/getBoardSnapshot';

/**
 * Server-rendered entry point for a single board. Fetches the last
 * persisted snapshot on the server (so the canvas isn't blank on first
 * paint) and hands it to the client component that owns the live Konva
 * canvas and realtime sync.
 */
export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialElements = await getBoardSnapshot(id);
  return <BoardPageClient boardId={id} initialElements={initialElements} />;
}
