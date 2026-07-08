import React, { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { insforge } from './lib/insforge'
import { useAuthStore } from './store/authStore'
import { Spinner } from './components/ui/Spinner'

function App() {
  const [loading, setLoading] = useState(true)
  const { setAuth } = useAuthStore()

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await insforge.auth.getSession()
        if (session?.user) {
          await loadUserData(session.user)
        }
      } catch (err) {
        console.error('Failed to initialize auth', err)
      } finally {
        setLoading(false)
      }
    }

    async function loadUserData(user) {
      let { data: profileData, error: profileError } = await insforge
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profileError) throw profileError

      if (!profileData) {
        await insforge.auth.signOut()
        throw new Error("No account found. Contact your administrator.")
      }
      
      let companyData = null
      let permissionsMap = {}

      const { data: cData } = await insforge
        .from('companies')
        .select('*')
        .eq('id', profileData.company_id)
        .single()
      companyData = cData

      const { data: pData } = await insforge
        .from('role_permissions')
        .select('*')
        .eq('company_id', profileData.company_id)
        .eq('role', profileData.role)

      if (pData) {
        pData.forEach(perm => {
          permissionsMap[perm.module] = {
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
            can_export: perm.can_export
          }
        })
      }

      setAuth({
        user,
        profile: profileData,
        company: companyData,
        role: profileData?.role || null,
        permissions: permissionsMap
      })
    }

    initAuth()

    const { data: { subscription } } = insforge.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().logout()
      } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        try {
          await loadUserData(session.user)
        } catch (err) {
          console.error('Failed to reload auth on session change', err)
        }
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [setAuth])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0A0A0A]">
        <Spinner size="lg" />
      </div>
    )
  }

  return <RouterProvider router={router} />
}

export default App
