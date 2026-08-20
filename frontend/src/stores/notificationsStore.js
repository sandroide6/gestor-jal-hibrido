import { create } from 'zustand';

export const useNotificationsStore = create((set, get) => ({
  notifications: [],
  unread: 0,
  loading: false,

  setAll: (notifications, unread) => set({ notifications, unread }),

  markOneRead: (id) =>
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unread: Math.max(0, state.unread - (state.notifications.find(n => n.id === id)?.read ? 0 : 1)),
    })),

  markAllRead: () =>
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unread: 0,
    })),

  removeOne: (id) =>
    set(state => {
      const n = state.notifications.find(n => n.id === id);
      return {
        notifications: state.notifications.filter(n => n.id !== id),
        unread: Math.max(0, state.unread - (n?.read ? 0 : 1)),
      };
    }),

  setLoading: (v) => set({ loading: v }),
}));
