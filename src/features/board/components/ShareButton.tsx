'use client';

import { useToastStore } from '@/store/useToastStore';

export function ShareButton() {
  const addToast = useToastStore((s) => s.addToast);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast('Board link copied to clipboard', 'success');
    } catch {
      addToast('Could not copy the link — copy it from the address bar.', 'error');
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
    >
      Share
    </button>
  );
}
