import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Photo = {
  id: string | number
  album_id?: string | number
  thumbnail_data?: string | null
  date_taken?: string | null
}

type CameraGalleryProps = {
  albumId: string | number
  cameraName: string
  onBack: () => void
}

function toDataUrl(value?: string | null) {
  if (!value) return ''
  return value.startsWith('data:image/')
    ? value
    : `data:image/jpeg;base64,${value}`
}

function photoDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function CameraGallery({
  albumId,
  cameraName,
  onBack,
}: CameraGalleryProps) {
  const accessToken = useAuthStore((state) => state.auth.accessToken)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [fullImage, setFullImage] = useState<{
    id: string | number
    src: string
  } | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [blobUrl, setBlobUrl] = useState('')

  const fullCache = useRef(new Map<string | number, string>())
  const pageSize = 8

  const token =
    sessionStorage.getItem('access_token') ||
    accessToken ||
    localStorage.getItem('access_token')

  const activePhoto =
    activeIndex === null ? undefined : photos[activeIndex]
  const activeId = activePhoto?.id

  const fullSrc =
    fullImage?.id === activeId ? fullImage?.src || '' : ''
  const imageSrc = fullSrc || toDataUrl(activePhoto?.thumbnail_data)

  // Load thumbnails for the selected page.
  useEffect(() => {
    const controller = new AbortController()

    async function loadPhotos() {
      setLoading(true)
      setError(null)

      try {
        if (!token) throw new Error('Please sign in to view photos.')

        const response = await fetch(
          `/photos/view_photos/${encodeURIComponent(albumId)}?page=${page}&limit=${pageSize}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'Your session has expired. Please sign in again.'
              : `Unable to load photos (${response.status}).`
          )
        }

        const data = await response.json()
        const items = Array.isArray(data) ? data : data?.photos

        if (
          !Array.isArray(items) ||
          !items.every(
            (item) =>
              item &&
              (typeof item.id === 'string' || typeof item.id === 'number')
          )
        ) {
          throw new Error('The server returned an unexpected photo list.')
        }

        const total = Array.isArray(data)
          ? data.length
          : Number(data.total ?? items.length)

        if (!Number.isFinite(total) || total < 0) {
          throw new Error('The server returned an invalid photo count.')
        }

        const pages = Math.max(1, Math.ceil(total / pageSize))

        if (!controller.signal.aborted) {
          setPageCount(pages)

          if (page > pages) {
            setPage(pages)
          } else {
            setPhotos(items)
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : 'Unable to load photos.'
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadPhotos()
    return () => controller.abort()
  }, [albumId, page, reload, token])

  // Load the selected full-size image, keeping thumbnails as a preview.
  useEffect(() => {
    if (activeId === undefined) return

    const controller = new AbortController()
    const cached = fullCache.current.get(activeId)

    setViewerError(null)
    setFullImage(cached ? { id: activeId, src: cached } : null)
    setLoadingFull(!cached)

    if (cached) return () => controller.abort()

    async function loadFullImage() {
      try {
        if (!token) throw new Error('Please sign in to view photos.')

        const response = await fetch(
          `/photos/photo/${encodeURIComponent(activeId!)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error(`Unable to load full image (${response.status}).`)
        }

        const data = await response.json()
        const value = data?.HD1080p_data ?? data?.photo_data

        if (typeof value !== 'string' || !value) {
          throw new Error('The full-size image is unavailable.')
        }

        const src = toDataUrl(value)

        if (!controller.signal.aborted) {
          fullCache.current.set(activeId!, src)
          setFullImage({ id: activeId!, src })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setViewerError(
            error instanceof Error ? error.message : 'Unable to load image.'
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoadingFull(false)
      }
    }

    void loadFullImage()
    return () => controller.abort()
  }, [activeId, token])

  // Blob URLs support opening the image in a separate browser tab.
  useEffect(() => {
    setBlobUrl('')
    if (!fullSrc) return

    let cancelled = false
    let objectUrl = ''

    void fetch(fullSrc)
      .then((response) => response.blob())
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setViewerError('Unable to prepare image download.')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fullSrc])

  useEffect(() => {
    if (activeIndex === null || deleting) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()

      const direction = event.key === 'ArrowLeft' ? -1 : 1

      setActiveIndex((index) =>
        index === null || !photos.length
          ? index
          : (index + direction + photos.length) % photos.length
      )
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, photos.length, deleting])

  function movePhoto(direction: number) {
    setActiveIndex((index) =>
      index === null || !photos.length
        ? index
        : (index + direction + photos.length) % photos.length
    )
  }

  async function deletePhoto() {
    if (!activePhoto || deleting) return

    const id = activePhoto.id

    if (!window.confirm(`Delete photo ${id}? This cannot be undone.`)) return

    setDeleting(true)
    setViewerError(null)

    try {
      if (!token) throw new Error('Please sign in again.')

      const response = await fetch(
        `/photos/photo/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (!response.ok) {
        throw new Error(`Unable to delete photo (${response.status}).`)
      }

      fullCache.current.delete(id)
      setActiveIndex(null)
      setPhotos((current) => current.filter((photo) => photo.id !== id))
      setReload((value) => value + 1)
    } catch (error) {
      setViewerError(
        error instanceof Error ? error.message : 'Unable to delete photo.'
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>{cameraName}</h2>
          <p className='text-sm text-muted-foreground'>
            Album {albumId} · Photos
          </p>
        </div>

        <Button variant='outline' onClick={onBack}>
          Back to cameras
        </Button>
      </div>

      {loading ? (
        <p role='status' className='py-8 text-muted-foreground'>
          Loading photos…
        </p>
      ) : error ? (
        <div role='alert' className='space-y-3'>
          <p className='text-sm text-destructive'>{error}</p>
          <Button
            variant='outline'
            onClick={() => setReload((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      ) : photos.length === 0 ? (
        <p className='py-8 text-muted-foreground'>No photos found.</p>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type='button'
              onClick={() => setActiveIndex(index)}
              aria-label={`Open photo ${photo.id}`}
              className='overflow-hidden rounded-xl border bg-card text-start shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            >
              {photo.thumbnail_data ? (
                <img
                  src={toDataUrl(photo.thumbnail_data)}
                  alt={`Photo ${photo.id}`}
                  loading='lazy'
                  className='aspect-video w-full object-cover'
                />
              ) : (
                <div className='flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground'>
                  No thumbnail
                </div>
              )}
              <div className='p-3 text-sm'>
                {photoDate(photo.date_taken) || `Photo ${photo.id}`}
              </div>
            </button>
          ))}
        </div>
      )}

      {!error && (
        <div className='flex items-center justify-center gap-4'>
          <Button
            variant='outline'
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <span className='text-sm'>
            Page {page} of {pageCount}
          </span>
          <Button
            variant='outline'
            disabled={loading || page >= pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog
        open={activeIndex !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setActiveIndex(null)
        }}
      >
        <DialogContent className='max-h-[95dvh] overflow-y-auto sm:max-w-5xl'>
          <DialogHeader>
            <DialogTitle>Photo {activePhoto?.id}</DialogTitle>
            <DialogDescription>
              {photoDate(activePhoto?.date_taken) || cameraName}
            </DialogDescription>
          </DialogHeader>

          {imageSrc && (
            <img
              src={imageSrc}
              alt={`Photo ${activePhoto?.id}`}
              className='max-h-[65vh] w-full rounded-md bg-black object-contain'
            />
          )}

          {loadingFull && (
            <p role='status' className='text-sm text-muted-foreground'>
              Loading full-size image…
            </p>
          )}

          {viewerError && (
            <p role='alert' className='text-sm text-destructive'>
              {viewerError}
            </p>
          )}

          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='outline'
              disabled={deleting || photos.length < 2}
              onClick={() => movePhoto(-1)}
            >
              Previous
            </Button>
            <Button
              variant='outline'
              disabled={deleting || photos.length < 2}
              onClick={() => movePhoto(1)}
            >
              Next
            </Button>

            {blobUrl && !loadingFull && (
              <>
                <Button variant='outline' asChild>
                  <a href={blobUrl} download={`photo-${activeId}.jpg`}>
                    Download
                  </a>
                </Button>
                <Button variant='outline' asChild>
                  <a href={blobUrl} target='_blank' rel='noopener noreferrer'>
                    View full size
                  </a>
                </Button>
              </>
            )}

            <Button
              variant='destructive'
              disabled={deleting}
              onClick={() => void deletePhoto()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}