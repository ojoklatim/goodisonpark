import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  company: null,
  role: null,
  permissions: {},

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setCompany: (company) => set({ company }),
  setRole: (role) => set({ role }),
  setPermissions: (permissions) => set({ permissions }),

  setAuth: ({ user, profile, company, role, permissions }) =>
    set({ user, profile, company, role, permissions }),

  logout: () => set({ user: null, profile: null, company: null, role: null, permissions: {} }),
}))
