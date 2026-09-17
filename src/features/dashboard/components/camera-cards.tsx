import { useEffect, useState } from 'react'
import { Camera as CameraIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Card } from '@/components/ui/card'
import { CameraGallery } from './camera-gallery'


type CameraItem = {
  id: number | string
  album: number | string
  name?: string | null
  status?: boolean | number | null
}

type CameraWithPreview = CameraItem & {
  imageSrc: string | null
}


type CameraCardsProps = {
  onGalleryChange?: (isOpen: boolean) => void
}

export function CameraCards({ onGalleryChange }: CameraCardsProps) {
  const accessToken = useAuthStore((state) => state.auth.accessToken)
  const [cameras, setCameras] = useState<CameraWithPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCamera, setSelectedCamera] =
    useState<CameraWithPreview | null>(null)

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
          throw new Error('Please sign in to view your cameras.')
        }

        const response = await fetch('/camera/cameras', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })

        if (response.status === 401) {
          throw new Error('Your session has expired. Please sign in again.')
        }

        if (!response.ok) {
          throw new Error(`Unable to load cameras (${response.status}).`)
        }

        const data: unknown = await response.json()

        if (
          !Array.isArray(data) ||
          !data.every(
            (camera) =>
              camera !== null &&
              typeof camera === 'object' &&
              (typeof camera.id === 'number' ||
                typeof camera.id === 'string') &&
              (typeof camera.album === 'number' ||
                typeof camera.album === 'string')
          )
        ) {
          throw new Error('The server returned an unexpected camera list.')
        }

        const cameraList = data as CameraItem[]

        const camerasWithPreviews = await Promise.all(
          cameraList.map(async (camera): Promise<CameraWithPreview> => {
            let imageSrc: string | null = null

            try {
              const photoResponse = await fetch(
                `/photos/latest_photo/${encodeURIComponent(camera.album)}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                  signal: controller.signal,
                }
              )

              if (photoResponse.ok) {
                const photo = await photoResponse.json()

                if (
                  typeof photo?.thumbnail_data === 'string' &&
                  photo.thumbnail_data.length > 0
                ) {
                  imageSrc = photo.thumbnail_data.startsWith('data:image/')
                    ? photo.thumbnail_data
                    : `data:image/jpeg;base64,${photo.thumbnail_data}`
                }
              }
            } catch {
              // Keep the camera visible when its preview is unavailable.
            }

            return { ...camera, imageSrc }
          })
        )

        if (!controller.signal.aborted) {
          setCameras(camerasWithPreviews)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : 'Unable to load cameras.'
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
  }, [accessToken])
  if (selectedCamera) {
  return (
    <CameraGallery
      key={String(selectedCamera.album)}
      albumId={selectedCamera.album}
      cameraName={
        selectedCamera.name || `Camera ${selectedCamera.id}`
      }
      onBack={() => {
        setSelectedCamera(null)
        onGalleryChange?.(false)
        }}
    />
  )
}

  if (loading) {
    return (
      <p role='status' className='py-8 text-sm text-muted-foreground'>
        Loading cameras…
      </p>
    )
  }

  if (error) {
    return (
      <p role='alert' className='py-8 text-sm text-destructive'>
        {error}
      </p>
    )
  }

  if (cameras.length === 0) {
    return (
      <p className='py-8 text-sm text-muted-foreground'>
        No cameras found.
      </p>
    )
  }

  return (
    <>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {cameras.map((camera) => {
          const name = camera.name || `Camera ${camera.id}`
          const online = Boolean(camera.status)

          return (
            <Card
              key={camera.id}
              className='overflow-hidden p-0 transition-shadow hover:shadow-md'
            >
              <button
                type='button'
                onClick={() => {
                setSelectedCamera(camera)
                onGalleryChange?.(true)
                }}
                aria-label={`Preview ${name}`}
                className='block h-full w-full cursor-pointer rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
              >
                <div className='aspect-video overflow-hidden bg-muted'>
                  {camera.imageSrc ? (
                    <img
                      src={camera.imageSrc}
                      alt={`Latest photo from ${name}`}
                      loading='lazy'
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <div className='flex h-full flex-col items-center justify-center gap-2 text-muted-foreground'>
                      <CameraIcon className='h-8 w-8' />
                      <span className='text-sm'>Preview unavailable</span>
                    </div>
                  )}
                </div>

                <div className='flex items-center justify-between gap-3 p-4'>
                  <span className='truncate font-semibold'>{name}</span>

                  <span className='flex shrink-0 items-center gap-2 text-xs text-muted-foreground'>
                    <span
                      aria-hidden='true'
                      className={`h-2 w-2 rounded-full ${
                        online ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    {online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </button>
            </Card>
          )
        })}
      </div>
    </>
  )
}