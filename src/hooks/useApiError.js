import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUiStore } from '../store/uiStore'

/**
 * Call this hook in any component that uses useQuery.
 * It intercepts query errors and shows appropriate toasts or redirects.
 *
 * Usage:
 *   const { data } = useQuery({ ..., onError: useApiError() })
 *
 * Or use the returned handler directly:
 *   const handleApiError = useApiError()
 *   handleApiError(error)
 */
export function useApiError() {
  const navigate = useNavigate()
  const { addNotification } = useUiStore()

  function handleError(error) {
    if (!error) return

    const status = error?.status || error?.code

    if (status === 401 || error?.message?.includes('JWT')) {
      addNotification({ type: 'error', title: 'Session expired', body: 'Please log in again.' })
      navigate('/auth/login')
      return
    }

    if (status === 403) {
      addNotification({ type: 'warning', title: 'Access Denied', body: 'You do not have permission to perform this action.' })
      return
    }

    if (status === 404) {
      addNotification({ type: 'info', title: 'Not Found', body: 'The requested resource could not be found.' })
      return
    }

    if (status >= 500 || error?.message?.includes('fetch')) {
      addNotification({ type: 'error', title: 'Something went wrong', body: 'A server error occurred. Please try again.' })
      return
    }

    // Generic fallback
    addNotification({ type: 'error', title: 'Error', body: error?.message || 'An unexpected error occurred.' })
  }

  return handleError
}
