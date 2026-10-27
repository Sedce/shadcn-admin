import { useAuthStore } from '@/stores/auth-store'

export function clearSession() {
  for (const storage of [sessionStorage, localStorage]) {
    storage.removeItem('access_token')
    storage.removeItem('refresh_token')
    storage.removeItem('username')
  }

  // Clears the auth store and its token cookie.
  useAuthStore.getState().auth.reset()
}

export function logoutAndRedirect() {
  clearSession()
  window.location.replace('/sign-in')
}