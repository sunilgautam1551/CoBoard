'use client';

import { useEffect } from 'react';
import { useToastStore } from '@/store/useToastStore';

const AUTO_DISMISS_MS = 4000;

const TYPE_STYLES: Record<string, string> = {
  info: 'bg-neutral-900 text-white',
  // emerald-600 fails WCAG AA (3.77:1) for white text at this size; -700 clears 4.5:1.
  success: 'bg-emerald-700 text-white',
  error: 'bg-red-600 text-white',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => removeToast(toast.id), AUTO_DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-3 rounded-md px-4 py-2 text-sm shadow-lg ${TYPE_STYLES[toast.type]}`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
            className="text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
