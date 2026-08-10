'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createBoard } from '@/features/board/actions/createBoard';
import { useToastStore } from '@/store/useToastStore';

export function NewBoardButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const addToast = useToastStore((s) => s.addToast);

  function handleClick() {
    startTransition(async () => {
      try {
        const id = await createBoard();
        router.push(`/board/${id}`);
      } catch {
        addToast('Could not create a board. Please try again.', 'error');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60"
    >
      {pending ? 'Creating board…' : 'New board'}
    </button>
  );
}
