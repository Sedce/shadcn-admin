import { createFileRoute } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
  beforeLoad: ({ location }) => {
  const accessToken = useAuthStore.getState().auth.accessToken

  if (!accessToken) {
    throw redirect({
      to: '/sign-in',
      search: {
        redirect: location.href,
      },
    })
  }
},
})
