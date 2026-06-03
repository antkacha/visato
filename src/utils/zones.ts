import { parseISO, addDays, differenceInDays, format } from 'date-fns'
import type { TripEntry, TrackedZone } from '../types'
import { countOverlapDays } from './schengen'
import { today } from './dateUtils'

export interface ZoneConfig {
  limitDays: number
  windowDays: number
  windowType: 'rolling' | 'per_entry'
}

export const ZONE_CONFIGS: Record<TrackedZone, ZoneConfig> = {
  uk:       { limitDays: 180, windowDays: 365, windowType: 'rolling' },
  usa:      { limitDays: 90,  windowDays: 180, windowType: 'rolling' },
  turkey:   { limitDays: 90,  windowDays: 180, windowType: 'rolling' },
  uae:      { limitDays: 90,  windowDays: 180, windowType: 'rolling' },
  thailand: { limitDays: 60,  windowDays: 0,   windowType: 'per_entry' },
  georgia:  { limitDays: 365, windowDays: 365, windowType: 'rolling' },
}

export interface ZoneStatus {
  zone: TrackedZone
  daysUsed: number
  daysRemaining: number
  limitDays: number
  windowDays: number
  isOverLimit: boolean
  windowType: 'rolling' | 'per_entry'
}

function rollingStatus(zone: TrackedZone, trips: TripEntry[], limitDays: number, windowDays: number): ZoneStatus {
  const todayISO = today()
  const winStart = format(addDays(parseISO(todayISO), -(windowDays - 1)), 'yyyy-MM-dd')
  const daysUsed = trips
    .filter((t) => t.entryDate <= todayISO)
    .reduce((sum, t) => {
      const exit = t.exitDate === 'ongoing' ? todayISO : t.exitDate
      return sum + countOverlapDays(t.entryDate, exit, winStart, todayISO)
    }, 0)
  return {
    zone, daysUsed, limitDays, windowDays,
    daysRemaining: Math.max(0, limitDays - daysUsed),
    isOverLimit: daysUsed > limitDays,
    windowType: 'rolling',
  }
}

function perEntryStatus(zone: TrackedZone, trips: TripEntry[], limitDays: number): ZoneStatus {
  const todayISO = today()
  const active = trips.filter((t) => t.entryDate <= todayISO)
  const base = { zone, limitDays, windowDays: 0, windowType: 'per_entry' as const }

  const ongoing = active.find((t) => t.exitDate === 'ongoing' || t.exitDate >= todayISO)
  if (ongoing) {
    const daysUsed = differenceInDays(parseISO(today()), parseISO(ongoing.entryDate)) + 1
    return { ...base, daysUsed, daysRemaining: Math.max(0, limitDays - daysUsed), isOverLimit: daysUsed > limitDays }
  }

  const last = [...active].sort((a, b) => b.exitDate.localeCompare(a.exitDate))[0]
  if (!last) {
    return { ...base, daysUsed: 0, daysRemaining: limitDays, isOverLimit: false }
  }
  const daysUsed = differenceInDays(parseISO(last.exitDate), parseISO(last.entryDate)) + 1
  return { ...base, daysUsed, daysRemaining: Math.max(0, limitDays - daysUsed), isOverLimit: daysUsed > limitDays }
}

export function computeZoneStatus(zone: TrackedZone, trips: TripEntry[]): ZoneStatus {
  const { limitDays, windowDays, windowType } = ZONE_CONFIGS[zone]
  return windowType === 'per_entry'
    ? perEntryStatus(zone, trips, limitDays)
    : rollingStatus(zone, trips, limitDays, windowDays)
}
