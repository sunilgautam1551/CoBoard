'use client';

import { useToastStore } from '@/store/useToastStore';

/**
 * Toolbar button that copies the current board's URL to the OS
 * clipboard — the entire "sharing" model for this app: anyone with the
 * link gets full read/write access, so there's no separate invite flow
 * to build or maintain.
 */
export function ShareButton() {
  const addToast = useToastStore((s) => s.addToast);

  /** Writes the current page URL to the clipboard and confirms it via toast. */
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
