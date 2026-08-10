import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'error';

export type Toast = { id: string; message: string; type: ToastType };

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = `${Date.now()}-${counter++}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
