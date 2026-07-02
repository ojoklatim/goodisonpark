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
          let { data: profileData, error: profileError } = await insforge
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()
          
          if (profileError) throw profileError

          if (!profileData) {
            // Self-healing: create profile record for users created directly in auth console
            const emailParts = user.email.split('@')[0].split('.')
            const firstName = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Employee'
            const lastName = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : 'User'

            const { data: newProfile, error: insertErr } = await insforge
              .from('profiles')
              .insert({
                id: user.id,
                company_id: 'c06f2d3e-4db5-4849-88bd-f4fa72970002', // Goodison Park Properties
                first_name: firstName,
                last_name: lastName,
                role: 'employee',
                is_active: true
              })
              .select()
              .single()

            if (insertErr) throw insertErr
            profileData = newProfile
          }
          
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
