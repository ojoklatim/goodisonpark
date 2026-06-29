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
          const user = session.user
          
          // Fetch profile
          const { data: profileData } = await insforge
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          let companyData = null
          let permissionsMap = {}

          if (profileData) {
            // Fetch company
            const { data: cData } = await insforge
              .from('companies')
              .select('*')
              .eq('id', profileData.company_id)
              .single()
            companyData = cData

            // Fetch role permissions
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
          }

          setAuth({
            user,
            profile: profileData,
            company: companyData,
            role: profileData?.role || null,
            permissions: permissionsMap
          })
        }
      } catch (err) {
        console.error('Failed to initialize auth', err)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = insforge.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().logout()
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
