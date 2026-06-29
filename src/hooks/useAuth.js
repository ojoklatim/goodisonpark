import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, profile, company, role, permissions } = useAuthStore()

  function can(module, action) {
    if (role === 'super_admin' || role === 'company_admin') return true
    const modulePerms = permissions[module]
    if (!modulePerms) return false
    return !!modulePerms[`can_${action}`]
  }

  return { user, profile, company, role, permissions, can }
}
