import { useEffect, useState } from 'react'
import { z } from 'zod'
import { CloudSun } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const weatherSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    weather_code: z.number(),
  }),
})

type Weather = z.infer<typeof weatherSchema>['current']

function describeWeather(code: number) {
  if (code === 0) return 'Clear sky'
  if (code === 1) return 'Mainly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if ([45, 48].includes(code)) return 'Fog'
  if ([51, 53, 55].includes(code)) return 'Drizzle'
  if ([56, 57].includes(code)) return 'Freezing drizzle'
  if ([61, 63, 65].includes(code)) return 'Rain'
  if ([66, 67].includes(code)) return 'Freezing rain'
  if ([71, 73, 75, 77].includes(code)) return 'Snow'
  if ([80, 81, 82].includes(code)) return 'Rain showers'
  if ([85, 86].includes(code)) return 'Snow showers'
  if ([95, 96, 99].includes(code)) return 'Thunderstorms'
  return 'Conditions unavailable'
}

export function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let inFlight = false

    async function loadWeather() {
      if (inFlight) return
      inFlight = true

      try {
        const params = new URLSearchParams({
          latitude: '56.246464',
          longitude: '-120.847633',
          current:
            'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
          temperature_unit: 'celsius',
          wind_speed_unit: 'kmh',
          timezone: 'auto',
        })

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params}`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error('Weather is temporarily unavailable.')
        }

        const data = weatherSchema.parse(await response.json())

        if (!controller.signal.aborted) {
          setWeather(data.current)
          setError(null)
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('Unable to update weather. Please try again later.')
        }
      } finally {
        inFlight = false
      }
    }

    void loadWeather()

    // Refresh every 15 minutes while the card is displayed.
    const interval = window.setInterval(
      () => void loadWeather(),
      15 * 60 * 1000
    )

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [])

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>Weather</CardTitle>
        <CloudSun
          aria-hidden='true'
          className='h-4 w-4 text-muted-foreground'
        />
      </CardHeader>

      <CardContent>
        {weather ? (
          <div className='space-y-1'>
            <div className='text-2xl font-bold'>
              {Math.round(weather.temperature_2m)}°C
            </div>

            <p className='text-sm'>
              {describeWeather(weather.weather_code)}
            </p>

            <p className='text-xs text-muted-foreground'>
              Humidity {weather.relative_humidity_2m}% · Wind{' '}
              {Math.round(weather.wind_speed_10m)} km/h
            </p>
          </div>
        ) : !error ? (
          <p role='status' className='text-sm text-muted-foreground'>
            Loading weather…
          </p>
        ) : null}

        {error && (
          <p role='status' className='mt-2 text-xs text-destructive'>
            {weather ? 'Showing previous weather. Update failed.' : error}
          </p>
        )}

        <a
          href='https://open-meteo.com/'
          target='_blank'
          rel='noopener noreferrer'
          className='mt-2 inline-block text-xs text-muted-foreground underline underline-offset-2'
        >
          Weather by Open-Meteo
        </a>
      </CardContent>
    </Card>
  )
}