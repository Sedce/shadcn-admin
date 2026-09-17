import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AddCameraDialog } from './components/add-camera-dialog'

const cameraSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  album: z.number().nullable().optional(),
  status: z.union([z.number(), z.boolean()]).nullable().optional(),
  timelapse: z.number().nullable().optional(),
  last_check_in: z.string().nullable().optional(),
})

type Camera = z.infer<typeof cameraSchema>

const PAGE_SIZE = 5

export function Tasks() {
  const accessToken = useAuthStore((state) => state.auth.accessToken)

  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [editingCamera, setEditingCamera] = useState<Camera | null>(null)
  const [cameraName, setCameraName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadCameras() {
      setLoading(true)
      setError(null)

      try {
        const token =
          sessionStorage.getItem('access_token') ||
          accessToken ||
          localStorage.getItem('access_token')

        if (!token) {
          throw new Error('Please sign in to view cameras.')
        }

        const response = await fetch('/camera/cameras', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'Your session has expired. Please sign in again.'
              : `Unable to load cameras (${response.status}).`
          )
        }

        const data = z.array(cameraSchema).parse(await response.json())

        if (!controller.signal.aborted) {
          setCameras(data)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof z.ZodError
              ? 'The server returned an unexpected camera response.'
              : error instanceof Error
                ? error.message
                : 'Unable to load cameras.'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadCameras()

    return () => controller.abort()
  }, [accessToken, reload])

  function openNameEditor(camera: Camera) {
    setEditingCamera(camera)
    setCameraName(camera.name || '')
    setNameError(null)
  }

  async function saveCameraName() {
    if (!editingCamera || savingName) return

    const name = cameraName.trim()

    if (!name || name.length > 255) {
      setNameError('Enter a name between 1 and 255 characters.')
      return
    }

    const cameraId = editingCamera.id

    setSavingName(true)
    setNameError(null)

    try {
      const token =
        sessionStorage.getItem('access_token') ||
        accessToken ||
        localStorage.getItem('access_token')

      if (!token) throw new Error('Please sign in again.')

      const response = await fetch(`/camera/camera/${cameraId}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.message || `Unable to rename camera (${response.status}).`
        )
      }

      const savedName = typeof data?.name === 'string' ? data.name : name

      setCameras((current) =>
        current.map((camera) =>
          camera.id === cameraId
            ? { ...camera, name: savedName }
            : camera
        )
      )

      setEditingCamera(null)
      toast.success('Camera name updated.')
    } catch (error) {
      setNameError(
        error instanceof Error ? error.message : 'Unable to rename camera.'
      )
    } finally {
      setSavingName(false)
    }
  }

  const filteredCameras = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return cameras.filter((camera) =>
      [camera.id, camera.name, camera.album]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(query))
    )
  }, [cameras, searchTerm])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCameras.length / PAGE_SIZE)
  )

  const page = Math.min(currentPage, totalPages)
  const start = (page - 1) * PAGE_SIZE
  const visibleCameras = filteredCameras.slice(start, start + PAGE_SIZE)

  async function deleteCamera(camera: Camera) {
    if (deletingId !== null) return

    const confirmed = window.confirm(
      `Delete "${camera.name || `Camera ${camera.id}`}"?\n\n` +
        'This removes its camera configuration and assigned permissions.'
    )

    if (!confirmed) return

    setDeletingId(camera.id)

    try {
      const token =
        sessionStorage.getItem('access_token') ||
        accessToken ||
        localStorage.getItem('access_token')

      if (!token) throw new Error('Please sign in again.')

      const response = await fetch(`/camera/camera/${camera.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.message || `Unable to delete camera (${response.status}).`
        )
      }

      setCameras((current) =>
        current.filter((item) => item.id !== camera.id)
      )

      toast.success('Camera deleted.')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to delete camera.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              Cameras
            </h2>
            <p className='text-muted-foreground'>
              Here&apos;s a list of cameras you have access to.
            </p>
          </div>

          <AddCameraDialog
            onCreated={() => setReload((value) => value + 1)}
          />
        </div>

        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Input
            placeholder='Filter cameras...'
            value={searchTerm}
            className='max-w-sm'
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setCurrentPage(1)
            }}
          />

          <Button
            variant='outline'
            disabled={loading}
            onClick={() => setReload((value) => value + 1)}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <p role='status' className='py-8 text-muted-foreground'>
            Loading cameras…
          </p>
        ) : error ? (
          <p role='alert' className='py-8 text-destructive'>
            {error}
          </p>
        ) : (
          <>
            <div className='overflow-x-auto rounded-lg border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50'>
                  <tr className='border-b text-left'>
                    <th className='p-4 font-medium'>ID</th>
                    <th className='p-4 font-medium'>Name</th>
                    <th className='p-4 font-medium'>Album</th>
                    <th className='p-4 font-medium'>Status</th>
                    <th className='whitespace-nowrap p-4 font-medium'>
                      Timelapse (seconds)
                    </th>
                    <th className='whitespace-nowrap p-4 font-medium'>
                      Last check-in
                    </th>
                    <th className='p-4 font-medium'>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleCameras.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className='p-8 text-center text-muted-foreground'
                      >
                        No cameras found.
                      </td>
                    </tr>
                  ) : (
                    visibleCameras.map((camera) => {
                      const online =
                        camera.status === true || camera.status === 1

                      return (
                        <tr
                          key={camera.id}
                          className='border-b last:border-b-0 hover:bg-muted/30'
                        >
                          <td className='p-4'>{camera.id}</td>

                          <td className='p-4 font-medium'>
                            {camera.name || `Camera ${camera.id}`}
                          </td>

                          <td className='p-4'>
                            {camera.album ?? '—'}
                          </td>

                          <td className='p-4'>
                            <span className='inline-flex items-center gap-2'>
                              <span
                                aria-hidden='true'
                                className={`h-2 w-2 rounded-full ${
                                  online ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                              />
                              {online ? 'Online' : 'Offline'}
                            </span>
                          </td>

                          <td className='p-4'>
                            {camera.timelapse ?? '—'}
                          </td>

                          <td className='whitespace-nowrap p-4'>
                            {camera.last_check_in
                              ?.replace('T', ' ')
                              .replace(/Z$/, ' UTC') || '—'}
                          </td>

                          <td className='p-4'>
                            <div className='flex items-center gap-2'>
                              <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                disabled={deletingId !== null || savingName}
                                aria-label={`Rename ${camera.name || camera.id}`}
                                onClick={() => openNameEditor(camera)}
                              >
                                <Pencil className='h-4 w-4' />
                              </Button>

                              <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                disabled={deletingId !== null || savingName}
                                aria-label={`Delete ${camera.name || camera.id}`}
                                onClick={() => void deleteCamera(camera)}
                              >
                                <Trash2
                                  className={`h-4 w-4 ${
                                    deletingId === camera.id
                                      ? 'animate-pulse'
                                      : ''
                                  }`}
                                />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className='flex flex-wrap items-center justify-between gap-3'>
              <p className='text-sm text-muted-foreground'>
                {filteredCameras.length} camera(s)
              </p>

              <div className='flex items-center gap-3'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => setCurrentPage(page - 1)}
                >
                  Previous
                </Button>

                <span className='text-sm'>
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= totalPages}
                  onClick={() => setCurrentPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Main>

      <Dialog
        open={editingCamera !== null}
        onOpenChange={(open) => {
          if (!open && !savingName) setEditingCamera(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit camera name</DialogTitle>
            <DialogDescription>
              Change the display name for this camera.
            </DialogDescription>
          </DialogHeader>

          <form
            className='space-y-4'
            onSubmit={(event) => {
              event.preventDefault()
              void saveCameraName()
            }}
          >
            <div className='space-y-2'>
              <label
                htmlFor='edit-camera-name'
                className='text-sm font-medium'
              >
                Camera name
              </label>

              <Input
                id='edit-camera-name'
                value={cameraName}
                onChange={(event) => setCameraName(event.target.value)}
                maxLength={255}
                required
                disabled={savingName}
                autoFocus
              />
            </div>

            {nameError && (
              <p role='alert' className='text-sm text-destructive'>
                {nameError}
              </p>
            )}

            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                disabled={savingName}
                onClick={() => setEditingCamera(null)}
              >
                Cancel
              </Button>

              <Button type='submit' disabled={savingName}>
                {savingName ? 'Saving…' : 'Save name'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}