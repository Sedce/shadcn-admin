import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { SlidersHorizontal, ArrowUpAZ, ArrowDownAZ } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const route = getRouteApi('/_authenticated/apps/')
const ITEMS_PER_PAGE = 9

// Your old archive prepended "photos/" to each returned path.
// Use an absolute path so it also works from /apps.
function videoSource(path: string) {
  const relativePath = path.replace(/^\/+/, '').replace(/^photos\//, '')

  return `/photos/${relativePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`
}

export function Apps() {
  const { filter = '', sort = 'asc' } = route.useSearch()
  const navigate = route.useNavigate()

  const accessToken = useAuthStore((state) => state.auth.accessToken)

  const [videos, setVideos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchVideos() {
      setLoading(true)
      setError(null)

      try {
        const token =
          sessionStorage.getItem('access_token') ||
          accessToken ||
          localStorage.getItem('access_token')

        if (!token) {
          throw new Error('Please sign in to view archived timelapses.')
        }

        const response = await fetch('/photos/videos', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'Your session has expired. Please sign in again.'
              : `Unable to load videos (${response.status}).`
          )
        }

        const data = await response.json()

        if (
          !Array.isArray(data?.videos) ||
          !data.videos.every(
            (video: unknown) => typeof video === 'string'
          )
        ) {
          throw new Error('The server returned an unexpected video list.')
        }

        if (!controller.signal.aborted) {
          setVideos([...new Set<string>(data.videos)])
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Unable to load videos.'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void fetchVideos()

    return () => controller.abort()
  }, [accessToken, reload])

  const filteredVideos = useMemo(() => {
    return videos
      .filter((video) =>
        video.toLowerCase().includes(filter.toLowerCase())
      )
      .sort((a, b) =>
        sort === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
      )
  }, [videos, filter, sort])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredVideos.length / ITEMS_PER_PAGE)
  )

  const page = Math.min(currentPage, totalPages)
  const startIndex = (page - 1) * ITEMS_PER_PAGE
  const currentItems = filteredVideos.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  const selectedIndex =
    selectedVideo === null
      ? -1
      : filteredVideos.indexOf(selectedVideo)

  function handleSearch(event: ChangeEvent<HTMLInputElement>) {
    setCurrentPage(1)

    void navigate({
      search: (previous) => ({
        ...previous,
        filter: event.target.value || undefined,
      }),
      replace: true,
    })
  }

  function handleSortChange(value: string) {
    if (value !== 'asc' && value !== 'desc') return

    setCurrentPage(1)

    void navigate({
      search: (previous) => ({
        ...previous,
        sort: value,
      }),
      replace: true,
    })
  }

  function openVideo(video: string) {
    setPlaybackError(false)
    setSelectedVideo(video)
  }

  function moveVideo(direction: number) {
    const nextVideo = filteredVideos[selectedIndex + direction]

    if (nextVideo !== undefined) {
      openVideo(nextVideo)
    }
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      {/* ===== Content ===== */}
      <Main fixed>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            Archive
          </h1>
          <p className='text-muted-foreground'>
            Here&apos;s a list of archived timelapses
          </p>
        </div>

        <div className='my-4 flex items-end justify-between sm:my-0 sm:items-center'>
          <div className='flex flex-col gap-4 sm:my-4 sm:flex-row'>
            <Input
              placeholder='Filter Timelapses...'
              className='h-9 w-40 lg:w-62.5'
              value={filter}
              onChange={handleSearch}
            />
          </div>

          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger className='w-16' aria-label='Sort timelapses'>
              <SelectValue>
                <SlidersHorizontal size={18} />
              </SelectValue>
            </SelectTrigger>

            <SelectContent align='end'>
              <SelectItem value='asc'>
                <div className='flex items-center gap-4'>
                  <ArrowUpAZ size={16} />
                  <span>Ascending</span>
                </div>
              </SelectItem>

              <SelectItem value='desc'>
                <div className='flex items-center gap-4'>
                  <ArrowDownAZ size={16} />
                  <span>Descending</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator className='shadow-sm' />

        <div className='min-h-0 flex-1 overflow-auto pt-4 pb-4'>
          {loading ? (
            <p role='status' className='py-8 text-muted-foreground'>
              Loading timelapses…
            </p>
          ) : error ? (
            <div role='alert' className='space-y-3 py-8'>
              <p className='text-sm text-destructive'>{error}</p>
              <Button
                variant='outline'
                onClick={() => setReload((value) => value + 1)}
              >
                Retry
              </Button>
            </div>
          ) : filteredVideos.length === 0 ? (
            <p className='py-8 text-muted-foreground'>
              {filter
                ? 'No timelapses match your search.'
                : 'No archived timelapses found.'}
            </p>
          ) : (
            <ul className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {currentItems.map((video) => (
                <li
                  key={video}
                  className='min-w-0 overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md'
                >
                  <button
                    type='button'
                    onClick={() => openVideo(video)}
                    aria-label={`Play ${video}`}
                    className='block w-full cursor-pointer text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
                  >
                    <video
                      src={videoSource(video)}
                      muted
                      playsInline
                      preload='metadata'
                      aria-hidden='true'
                      className='pointer-events-none aspect-video w-full bg-black object-cover'
                    />

                    <div className='p-4'>
                      <h2 className='break-words text-sm font-semibold'>
                        {video}
                      </h2>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        Click to play
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && !error && filteredVideos.length > 0 && (
          <div className='flex shrink-0 items-center justify-center gap-4 py-4'>
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
        )}
      </Main>

      <Dialog
        open={selectedVideo !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedVideo(null)
        }}
      >
        <DialogContent className='max-h-[95dvh] overflow-y-auto sm:max-w-5xl'>
          <DialogHeader>
            <DialogTitle>Archived timelapse</DialogTitle>
            <DialogDescription className='break-all'>
              {selectedVideo}
            </DialogDescription>
          </DialogHeader>

          {selectedVideo !== null && (
            <video
              key={selectedVideo}
              src={videoSource(selectedVideo)}
              controls
              playsInline
              preload='metadata'
              onError={() => setPlaybackError(true)}
              className='max-h-[70vh] w-full rounded-md bg-black'
            >
              Your browser does not support video playback.
            </video>
          )}

          {playbackError && (
            <p role='alert' className='text-sm text-destructive'>
              Unable to play this video. The file may be unavailable,
              require authorization, or use an unsupported format.
            </p>
          )}

          <div className='flex justify-between gap-2'>
            <Button
              variant='outline'
              disabled={selectedIndex <= 0}
              onClick={() => moveVideo(-1)}
            >
              Previous video
            </Button>

            <Button
              variant='outline'
              disabled={
                selectedIndex < 0 ||
                selectedIndex >= filteredVideos.length - 1
              }
              onClick={() => moveVideo(1)}
            >
              Next video
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}