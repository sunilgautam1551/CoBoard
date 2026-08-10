import { NewBoardButton } from '@/features/board/components/NewBoardButton';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          CoBoard
        </h1>
        <p className="max-w-md text-balance text-neutral-600">
          A real-time, multiplayer infinite-canvas whiteboard. Create a
          board, share the link, and draw together instantly — no signup
          required.
        </p>
      </div>
      <NewBoardButton />
    </main>
  );
}
