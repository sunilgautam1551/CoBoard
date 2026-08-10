'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { newBoardId } from '@/lib/utils';

export function NewBoardButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function handleClick() {
    setPending(true);
    const id = newBoardId();
    router.push(`/board/${id}`);
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
