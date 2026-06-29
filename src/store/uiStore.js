import { create } from 'zustand'

export const useUiStore = create((set) => ({
  sidebarOpen: false,
  activePage: '',
  notifications: [],
  toasts: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActivePage: (page) => set({ activePage: page }),

  addNotification: (notification) =>
    set((s) => ({
      notifications: [
        { id: Date.now() + Math.random(), ...notification },
        ...s.notifications,
      ].slice(0, 50),
    })),

  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  clearNotifications: () => set({ notifications: [] }),

  addToast: (toast) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: Date.now() + Math.random(), ...toast },
      ],
    })),

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
