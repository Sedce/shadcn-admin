import { type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

export function AdminGate({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((state) => state.auth.accessToken)

  const username =
    sessionStorage.getItem('username') ||
    localStorage.getItem('username') ||
    ''

  const isAdmin =
    Boolean(accessToken) &&
    username.trim().toLowerCase() === 'cedez'

  if (isAdmin) {
    return <>{children}</>
  }

  return (
    <div className='relative min-h-[360px] overflow-hidden rounded-xl border'>
      <div
        aria-hidden='true'
        className='pointer-events-none select-none space-y-5 p-6 blur-sm'
      >
        <div className='h-8 w-48 rounded bg-muted' />

        <div className='grid grid-cols-2 gap-4'>
          <div className='h-24 rounded-lg bg-muted' />
          <div className='h-24 rounded-lg bg-muted' />
        </div>

        <div className='h-12 rounded bg-muted' />
        <div className='h-12 rounded bg-muted' />
        <div className='h-12 rounded bg-muted' />
      </div>

      <div className='absolute inset-0 flex items-center justify-center bg-background/60 p-6'>
        <div className='max-w-sm text-center'>
          <Lock
            aria-hidden='true'
            className='mx-auto mb-3 h-8 w-8 text-muted-foreground'
          />

          <h2 className='text-lg font-semibold'>
            Admin access required
          </h2>

          <p className='mt-2 text-sm text-muted-foreground'>
            You don’t have permission to view this page.
          </p>
        </div>
      </div>
    </div>
  )
}