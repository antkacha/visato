import type { TripEntry, AppSettings } from '../types'


const TRIPS_KEY = 'schengen_trips'
const SETTINGS_KEY = 'schengen_settings'
const MIGRATION_V2_KEY = 'schengen_migration_v2'
const MIGRATION_V3_KEY = 'schengen_migration_v3'

const DEFAULT_SETTINGS: AppSettings = { theme: 'light', language: 'en' }

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
    const settings: AppSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    if (!localStorage.getItem(MIGRATION_V2_KEY)) {
      localStorage.setItem(MIGRATION_V2_KEY, '1')
      settings.theme = 'light'
      saveSettings(settings)
    }
    if (!localStorage.getItem(MIGRATION_V3_KEY)) {
      localStorage.setItem(MIGRATION_V3_KEY, '1')
      if ((settings.language as string) === 'ru') {
        settings.language = 'uk'
        saveSettings(settings)
      }
    }
    return settings
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
