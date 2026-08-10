'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createBoard } from '@/features/board/actions/createBoard';
import { useToastStore } from '@/store/useToastStore';

/**
 * Landing-page CTA that provisions a brand-new board and navigates to
 * it. The row insert plus redirect is wrapped in a `useTransition` so
 * the button can show its own pending state without blocking the rest
 * of the page, and a failed insert surfaces as a toast instead of an
 * unhandled rejection.
 */
export function NewBoardButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const addToast = useToastStore((s) => s.addToast);

  /** Creates the board row, then navigates to its freshly assigned id. */
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
