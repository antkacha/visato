import type { TripEntry, AppSettings } from '../types'

const TRIPS_KEY = 'schengen_trips'
const SETTINGS_KEY = 'schengen_settings'

const DEFAULT_SETTINGS: AppSettings = { theme: 'light', language: 'en', residencyStatus: 'tourist' }

export function loadTrips(): TripEntry[] {
  try {
    const raw = localStorage.getItem(TRIPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveTrips(trips: TripEntry[]): void {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips))
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function validateImportedTrips(data: unknown): TripEntry[] {
  if (!Array.isArray(data)) throw new Error('Not an array')
  return data.map((item, i) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>).id !== 'string' ||
      typeof (item as Record<string, unknown>).entryDate !== 'string' ||
      typeof (item as Record<string, unknown>).exitDate !== 'string' ||
      typeof (item as Record<string, unknown>).country !== 'string'
    ) {
      throw new Error(`Invalid trip at index ${i}`)
    }
    return item as TripEntry
  })
}
