import { useRef, useState } from 'react'
import { type DateRange } from 'react-day-picker'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type GenerateTimelapseProps = {
  albumId?: string | number
}

export function GenerateTimelapse({
  albumId,
}: GenerateTimelapseProps) {
  const accessToken = useAuthStore((state) => state.auth.accessToken)

  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>()
  const [generating, setGenerating] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Prevent duplicate submissions before React updates the button.
  const submitting = useRef(false)

  async function generateTimelapse() {
    if (
      submitting.current ||
      albumId === undefined ||
      !range?.from ||
      !range?.to
    ) {
      return
    }

    const from = range.from
    const to = range.to

    if (to < from) {
      setError('End date must not be before start date.')
      return
    }

    submitting.current = true
    setGenerating(true)
    setError(null)
    setVideoUrl('')

    try {
      const token =
        sessionStorage.getItem('access_token') ||
        accessToken ||
        localStorage.getItem('access_token')

      if (!token) {
        throw new Error('Please sign in again.')
      }

      const formData = new FormData()

      // Matches your existing Flask parse_verbose_date() function.
      formData.append('begin_date', from.toString())
      formData.append('end_date', to.toString())

      const response = await fetch(
        `/photos/generate_timelapse/${encodeURIComponent(albumId)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No photos were found for the selected dates.')
        }

        if (response.status === 401) {
          throw new Error('Your session has expired. Please sign in again.')
        }

        if (response.status === 502 || response.status === 504) {
          throw new Error(
            'The server connection timed out. Generation may still be running. Check “View latest timelapse” before submitting again.'
          )
        }

        throw new Error(
          data?.message ||
            `Unable to generate the timelapse (${response.status}).`
        )
      }

      if (
        typeof data?.generated_video_path !== 'string' ||
        !data.generated_video_path.trim()
      ) {
        throw new Error(
          'The server did not return a video path. Check the latest timelapse before submitting again.'
        )
      }

      const relativePath = data.generated_video_path
        .trim()
        .replace(/^\/+/, '')
        .replace(/^photos\//, '')

      setVideoUrl(
        `/photos/${relativePath
          .split('/')
          .map((part: string) => encodeURIComponent(part))
          .join('/')}`
      )
    } catch (error) {
      setError(
        error instanceof TypeError
          ? 'The connection failed. Generation may still be running. Check “View latest timelapse” before submitting again.'
          : error instanceof Error
            ? error.message
            : 'Unable to generate the timelapse.'
      )
    } finally {
      submitting.current = false
      setGenerating(false)
    }
  }

  function openDialog() {
    setError(null)
    setVideoUrl('')
    setOpen(true)
  }

  return (
    <>
      <Button
        type='button'
        size='sm'
        disabled={albumId === undefined || generating}
        onClick={openDialog}
      >
        {generating ? 'Generating…' : 'Generate timelapse'}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (submitting.current) return

          setOpen(nextOpen)

          if (!nextOpen) {
            setVideoUrl('')
            setError(null)
          }
        }}
      >
        <DialogContent
          className={
            videoUrl
              ? 'max-h-[95dvh] overflow-y-auto sm:max-w-5xl'
              : 'max-h-[95dvh] overflow-y-auto sm:max-w-md'
          }
        >
          <DialogHeader>
            <DialogTitle>
              {videoUrl ? 'Generated timelapse' : 'Generate timelapse'}
            </DialogTitle>
            <DialogDescription>
              {videoUrl
                ? 'Your timelapse is ready to play.'
                : 'Select the first and last day to include.'}
            </DialogDescription>
          </DialogHeader>

          {videoUrl ? (
            <video
              key={videoUrl}
              src={videoUrl}
              controls
              playsInline
              preload='metadata'
              onError={() =>
                setError(
                  'The video was generated, but playback failed. Check its media URL or try opening it from Archive.'
                )
              }
              className='max-h-[70vh] w-full rounded-md bg-black'
            >
              Your browser does not support video playback.
            </video>
          ) : (
            <div className='flex justify-center'>
              <Calendar
                mode='range'
                selected={range}
                onSelect={setRange}
                numberOfMonths={1}
                defaultMonth={range?.from}
                disabled={generating}
              />
            </div>
          )}

          {generating && (
            <p role='status' className='text-sm text-muted-foreground'>
              Generating your timelapse. Keep this page open until it
              finishes. Larger date ranges may take several minutes.
            </p>
          )}

          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}

          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              disabled={generating}
              onClick={() => {
                setOpen(false)
                setVideoUrl('')
                setError(null)
              }}
            >
              {videoUrl ? 'Close' : 'Cancel'}
            </Button>

            {!videoUrl && (
              <Button
                type='button'
                disabled={generating || !range?.from || !range?.to}
                onClick={() => void generateTimelapse()}
              >
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}