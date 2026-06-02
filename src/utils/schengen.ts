import { parseISO, addDays, differenceInDays, format, min, max } from 'date-fns'
import type { TripEntry, ResetEvent, TripValidationResult } from '../types'

const FMT = 'yyyy-MM-dd'

function parse(iso: string): Date {
  return parseISO(iso)
}

function toISO(d: Date): string {
  return format(d, FMT)
}

function resolveExit(trip: TripEntry, refISO: string): string {
  return trip.exitDate === 'ongoing' ? refISO : trip.exitDate
}

/**
 * Days in the overlap of [tripEntry, tripExit] and [winStart, winEnd], inclusive.
 * Both entry and exit day count as full Schengen days.
 */
export function countOverlapDays(
  tripEntry: string,
  tripExit: string,
  winStart: string,
  winEnd: string
): number {
  const overlapStart = max([parse(tripEntry), parse(winStart)])
  const overlapEnd = min([parse(tripExit), parse(winEnd)])
  if (overlapStart > overlapEnd) return 0
  return differenceInDays(overlapEnd, overlapStart) + 1
}

/**
 * Days spent in Schengen in the 180-day window ending at refISO.
 * Window = [refISO − 179 days, refISO].
 */
export function getDaysUsedInWindow(
  trips: TripEntry[],
  refISO: string,
  includePlanned = false
): number {
  const winStart = toISO(addDays(parse(refISO), -179))
  return trips
    .filter((t) => !t.isPlanned || includePlanned)
    .reduce(
      (sum, t) =>
        sum + countOverlapDays(t.entryDate, resolveExit(t, refISO), winStart, refISO),
      0
    )
}

/**
 * Upcoming dates when past Schengen days fall out of the 180-day window,
 * freeing capacity. A day D spent in Schengen exits the window on D+180.
 */
export function getResetEvents(trips: TripEntry[], todayISO: string): ResetEvent[] {
  const today = parse(todayISO)
  const releaseCounts = new Map<string, number>()

  for (const trip of trips.filter((t) => !t.isPlanned)) {
    const entry = parse(trip.entryDate)
    const exit = parse(resolveExit(trip, todayISO))
    // Only past/current days contribute to future releases
    const rangeEnd = min([exit, today])
    if (entry > rangeEnd) continue

    const span = differenceInDays(rangeEnd, entry)
    for (let i = 0; i <= span; i++) {
      const day = addDays(entry, i)
      const releaseISO = toISO(addDays(day, 180))
      if (releaseISO > todayISO) {
        releaseCounts.set(releaseISO, (releaseCounts.get(releaseISO) ?? 0) + 1)
      }
    }
  }

  let runningUsed = getDaysUsedInWindow(trips, todayISO)
  return [...releaseCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, released]) => {
      runningUsed = Math.max(0, runningUsed - released)
      return { date, daysReleased: released, totalAfter: 90 - runningUsed }
    })
}

/**
 * Validate whether adding trip [entryISO, exitISO] violates the 90/180 rule
 * at any day during the trip.
 */
export function validatePlannedTrip(
  existing: TripEntry[],
  entryISO: string,
  exitISO: string
): TripValidationResult {
  const entry = parse(entryISO)
  const exit = parse(exitISO)
  const totalDays = differenceInDays(exit, entry) + 1

  if (totalDays > 90) {
    return { isValid: false, maxSafeDays: 90 }
  }

  const nonPlanned = existing.filter((t) => !t.isPlanned)

  for (let i = 0; i < totalDays; i++) {
    const dayISO = toISO(addDays(entry, i))
    const winStart = toISO(addDays(parse(dayISO), -179))

    const existingDays = nonPlanned.reduce(
      (sum, t) =>
        sum + countOverlapDays(t.entryDate, resolveExit(t, dayISO), winStart, dayISO),
      0
    )
    // Days of the new trip that land inside [winStart, dayISO]
    const newTripDays = countOverlapDays(entryISO, dayISO, winStart, dayISO)

    if (existingDays + newTripDays > 90) {
      return {
        isValid: false,
        firstViolationDate: dayISO,
        daysOverLimit: existingDays + newTripDays - 90,
        maxSafeDays: i,
      }
    }
  }

  return { isValid: true }
}

/**
 * Maximum consecutive safe days starting from startISO given existing trips.
 */
export function getMaxConsecutiveDays(existing: TripEntry[], startISO: string): number {
  for (let i = 0; i < 90; i++) {
    const exitISO = toISO(addDays(parse(startISO), i))
    if (!validatePlannedTrip(existing, startISO, exitISO).isValid) return i
  }
  return 90
}

/**
 * Returns true if trip A and trip B share at least one calendar day.
 */
export function tripsOverlap(
  aEntry: string,
  aExit: string,
  bEntry: string,
  bExit: string
): boolean {
  const ae = parse(aEntry)
  const ax = parse(aExit === 'ongoing' ? '9999-12-31' : aExit)
  const be = parse(bEntry)
  const bx = parse(bExit === 'ongoing' ? '9999-12-31' : bExit)
  return ae <= bx && be <= ax
}
