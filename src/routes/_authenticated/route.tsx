import { createFileRoute } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { clearSession } from '@/lib/logout'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
  beforeLoad: async ({ location }) => {
  const token =
    sessionStorage.getItem('access_token') ||
    useAuthStore.getState().auth.accessToken ||
    localStorage.getItem('access_token')

  if (!token) {
    clearSession()

    throw redirect({
      to: '/sign-in',
      search: { redirect: location.href },
    })
  }

  // A saved token may have expired. Ask Flask to validate it.
  const response = await fetch('/auth/user', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 401 || response.status === 422) {
    clearSession()

    throw redirect({
      to: '/sign-in',
      search: { redirect: location.href },
    })
  }

  if (!response.ok) {
    throw new Error('Unable to verify your session. Please try again.')
  }
},
})
