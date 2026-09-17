import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
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

type Props = {
  onCreated: () => void
}

const initialValues = {
  name: '',
  camera_id: '',
  source: '',
  album: '',
  timelapse: '600',
}

const numberFields = [
  { name: 'camera_id', label: 'Device camera ID' },
  { name: 'source', label: 'Source' },
  { name: 'album', label: 'Album' },
  { name: 'timelapse', label: 'Timelapse interval (seconds)' },
] as const

export function AddCameraDialog({ onCreated }: Props) {
  const accessToken = useAuthStore((state) => state.auth.accessToken)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState(initialValues)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    try {
      const token =
        sessionStorage.getItem('access_token') ||
        accessToken ||
        localStorage.getItem('access_token')

      if (!token) throw new Error('Please sign in again.')

      const payload = {
        name: values.name.trim(),
        camera_id: Number(values.camera_id),
        source: Number(values.source),
        album: Number(values.album),
        timelapse: Number(values.timelapse),
      }

      if (!payload.name) {
        throw new Error('Camera name is required.')
      }

      for (const field of numberFields) {
        const value = payload[field.name]

        if (!Number.isSafeInteger(value) || value <= 0) {
          throw new Error(`${field.label} must be a positive whole number.`)
        }
      }

      const response = await fetch('/camera/cameras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.message || `Unable to create camera (${response.status}).`
        )
      }

      setValues(initialValues)
      setOpen(false)

      toast.success(
        'Camera created. It will appear in the list once access is assigned.'
      )

      onCreated()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to create camera.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <Plus className='mr-2 h-4 w-4' />
        Add camera
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!saving) setOpen(nextOpen)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add camera</DialogTitle>
            <DialogDescription>
              Enter the device configuration. Permissions are managed separately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <label htmlFor='camera-name' className='text-sm font-medium'>
                Name
              </label>
              <Input
                id='camera-name'
                value={values.name}
                maxLength={255}
                required
                disabled={saving}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>

            {numberFields.map((field) => (
              <div key={field.name} className='space-y-2'>
                <label
                  htmlFor={`camera-${field.name}`}
                  className='text-sm font-medium'
                >
                  {field.label}
                </label>
                <Input
                  id={`camera-${field.name}`}
                  type='number'
                  min={1}
                  step={1}
                  required
                  disabled={saving}
                  value={values[field.name]}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.name]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}

            {error && (
              <p role='alert' className='text-sm text-destructive'>
                {error}
              </p>
            )}

            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={saving}>
                {saving ? 'Saving…' : 'Add camera'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}