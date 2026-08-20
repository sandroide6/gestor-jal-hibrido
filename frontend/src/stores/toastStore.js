import { create } from 'zustand';

let _nextId = 1;

export const useToastStore = create((set) => ({
  toasts: [],

  add(message, type = 'info', duration = 4000) {
    const id = _nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    if (duration > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration);
    }
    return id;
  },

  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (msg, duration) => useToastStore.getState().add(msg, 'success', duration),
  error:   (msg, duration) => useToastStore.getState().add(msg, 'error',   duration ?? 6000),
  info:    (msg, duration) => useToastStore.getState().add(msg, 'info',    duration),
  warning: (msg, duration) => useToastStore.getState().add(msg, 'warning', duration),
};
