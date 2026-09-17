import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent} from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Analytics } from './components/analytics'
import { CameraCards } from './components/camera-cards'
import { WeatherCard } from './components/weather-card'
import { format } from 'date-fns'
import { type DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRef } from 'react'
import { useAuthStore } from '@/stores/auth-store'

export function Dashboard() {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [dateDialogOpen, setDateDialogOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>()
  const [photoRange, setPhotoRange] = useState<
    { start: string; end: string } | undefined
  >()
  const accessToken = useAuthStore((state) => state.auth.accessToken)

  const [selectedAlbumId, setSelectedAlbumId] = useState<
    string | number | undefined
  >()

  const [latestVideoOpen, setLatestVideoOpen] = useState(false)
  const [latestVideoLoading, setLatestVideoLoading] = useState(false)
  const [latestVideoUrl, setLatestVideoUrl] = useState('')
  const [latestVideoError, setLatestVideoError] = useState<string | null>(null)

  const latestVideoRequest = useRef(0)

function handleGalleryChange(
  isOpen: boolean,
  albumId?: string | number
) {
  setIsGalleryOpen(isOpen)
  setSelectedAlbumId(isOpen ? albumId : undefined)

  setPhotoRange(undefined)
  setDraftRange(undefined)
  setDateDialogOpen(false)

  // Ignore any pending response for the previous camera.
  latestVideoRequest.current += 1
  setLatestVideoOpen(false)
  setLatestVideoLoading(false)
  setLatestVideoUrl('')
  setLatestVideoError(null)
}

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  async function viewLatestTimelapse() {
  if (selectedAlbumId === undefined) return

  const requestId = ++latestVideoRequest.current

  setLatestVideoOpen(true)
  setLatestVideoLoading(true)
  setLatestVideoUrl('')
  setLatestVideoError(null)

  try {
    const token =
      sessionStorage.getItem('access_token') ||
      accessToken ||
      localStorage.getItem('access_token')

    if (!token) throw new Error('Please sign in again.')

    const response = await fetch(
      `/photos/latest/timelapse/${encodeURIComponent(selectedAlbumId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? 'No timelapse is available for this camera yet.'
          : response.status === 401
            ? 'Your session has expired. Please sign in again.'
            : data?.message || 'Unable to load the latest timelapse.'
      )
    }

    if (
      typeof data?.generated_video_path !== 'string' ||
      !data.generated_video_path.trim()
    ) {
      throw new Error('No timelapse is available for this camera yet.')
    }

    // Preserve your old /photos/ media URL convention.
    const relativePath = data.generated_video_path
      .trim()
      .replace(/^\/+/, '')
      .replace(/^photos\//, '')

    const videoUrl = `/photos/${relativePath
      .split('/')
      .map((part: string) => encodeURIComponent(part))
      .join('/')}`

    if (requestId === latestVideoRequest.current) {
      setLatestVideoUrl(videoUrl)
    }
  } catch (error) {
    if (requestId === latestVideoRequest.current) {
      setLatestVideoError(
        error instanceof Error
          ? error.message
          : 'Unable to load the latest timelapse.'
      )
    }
  } finally {
    if (requestId === latestVideoRequest.current) {
      setLatestVideoLoading(false)
    }
  }
}

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          {/* <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1> */}
          {/* <div className='flex items-center space-x-2'>
            <Button>Download</Button>
          </div> */}
        </div>
        <Tabs
          orientation='vertical'
          defaultValue='overview'
          className='space-y-4'
        >
          <TabsContent value='overview' className='space-y-4'>
            <div>
              {isGalleryOpen ? (
                <div className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    onClick={() => setDateDialogOpen(true)}
                  >
                    {photoRange
                      ? `${photoRange.start} — ${photoRange.end}`
                      : 'Date range'}
                  </Button>
                  <Button type='button' size='sm' disabled className='disabled:opacity-100'>
                    Generate timelapse
                  </Button>
                  <Button
                  type='button'
                  size='sm'
                  disabled={selectedAlbumId === undefined || latestVideoLoading}
                  onClick={() => void viewLatestTimelapse()}
                >
                  {latestVideoLoading ? 'Loading…' : 'View latest timelapse'}
                </Button>
                </div>
              ) : (
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Time & Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold tabular-nums'>
                    {now.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    {now.toLocaleDateString([], {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </CardContent>
              </Card>
              {/* <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Weather
                  </CardTitle>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    className='h-4 w-4 text-muted-foreground'
                  >
                    <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
                    <circle cx='9' cy='7' r='4' />
                    <path d='M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'></div>
                  <p className='text-xs text-muted-foreground'>
                    
                  </p>
                </CardContent>
              </Card> */}
              <WeatherCard />

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'></CardTitle>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    className='h-4 w-4 text-muted-foreground'
                  >
                    <rect width='20' height='14' x='2' y='5' rx='2' />
                    <path d='M2 10h20' />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'></div>
                  <p className='text-xs text-muted-foreground'>
                    
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Active Now
                  </CardTitle>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    className='h-4 w-4 text-muted-foreground'
                  >
                    <path d='M22 12h-4l-3 9L9 3l-3 9H2' />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>+573</div>
                  <p className='text-xs text-muted-foreground'>
                    +201 since last hour
                  </p>
                </CardContent>
              </Card>
                </div>
              )}
            </div>
            <CameraCards
              onGalleryChange={handleGalleryChange}
              startDate={photoRange?.start}
              endDate={photoRange?.end}
            />
          </TabsContent>
          <TabsContent value='analytics' className='space-y-4'>
            <Analytics />
          </TabsContent>
        </Tabs>
      </Main>
      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
      <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Filter photos by date</DialogTitle>
          <DialogDescription>
            Select a start and end date. Both days are included.
          </DialogDescription>
        </DialogHeader>

        <div className='flex justify-center'>
          <Calendar
            mode='range'
            selected={draftRange}
            onSelect={setDraftRange}
            numberOfMonths={1}
            defaultMonth={draftRange?.from}
          />
        </div>

        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              setDraftRange(undefined)
              setPhotoRange(undefined)
              setDateDialogOpen(false)
            }}
          >
            Clear
          </Button>

          <Button
            type='button'
            disabled={!draftRange?.from || !draftRange?.to}
            onClick={() => {
              if (!draftRange?.from || !draftRange?.to) return

              setPhotoRange({
                start: format(draftRange.from, 'yyyy-MM-dd'),
                end: format(draftRange.to, 'yyyy-MM-dd'),
              })

              setDateDialogOpen(false)
            }}
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog
  open={latestVideoOpen}
  onOpenChange={(open) => {
    setLatestVideoOpen(open)

    if (!open) {
      latestVideoRequest.current += 1
      setLatestVideoUrl('')
      setLatestVideoLoading(false)
      setLatestVideoError(null)
    }
  }}
>
  <DialogContent className='max-h-[95dvh] overflow-y-auto sm:max-w-5xl'>
    <DialogHeader>
      <DialogTitle>Latest timelapse</DialogTitle>
      <DialogDescription>
        Most recent timelapse for the selected camera.
      </DialogDescription>
    </DialogHeader>

    {latestVideoLoading && (
      <p role='status' className='py-8 text-center text-muted-foreground'>
        Loading latest timelapse…
      </p>
    )}

    {latestVideoError && (
      <p role='alert' className='text-sm text-destructive'>
        {latestVideoError}
      </p>
    )}

    {latestVideoOpen && latestVideoUrl && !latestVideoLoading && (
      <video
        key={latestVideoUrl}
        src={latestVideoUrl}
        controls
        playsInline
        preload='metadata'
        onError={() =>
          setLatestVideoError(
            'Unable to play this video. Check that the media URL is accessible and the video format is supported.'
          )
        }
        className='max-h-[70vh] w-full rounded-md bg-black'
      >
        Your browser does not support video playback.
      </video>
    )}
  </DialogContent>
</Dialog>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: '/',
    isActive: true,
    disabled: false,
  },
]
