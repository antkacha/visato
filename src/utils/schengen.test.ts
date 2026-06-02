import { describe, it, expect } from 'vitest'
import {
  countOverlapDays,
  getDaysUsedInWindow,
  getResetEvents,
  validatePlannedTrip,
  getMaxConsecutiveDays,
  tripsOverlap,
} from './schengen'
import type { TripEntry } from '../types'

function trip(entry: string, exit: string, isPlanned = false): TripEntry {
  return { id: 'test', entryDate: entry, exitDate: exit, country: 'france', isPlanned }
}

describe('countOverlapDays', () => {
  it('counts same-day trip as 1 day', () => {
    expect(countOverlapDays('2025-01-10', '2025-01-10', '2024-07-15', '2025-01-10')).toBe(1)
  })

  it('counts full overlap correctly', () => {
    expect(countOverlapDays('2025-01-01', '2025-01-10', '2024-12-01', '2025-03-01')).toBe(10)
  })

  it('clips trip to window boundaries', () => {
    // trip 2025-01-01 to 2025-01-20, window 2025-01-05 to 2025-01-15 → 11 days
    expect(countOverlapDays('2025-01-01', '2025-01-20', '2025-01-05', '2025-01-15')).toBe(11)
  })

  it('returns 0 for non-overlapping ranges', () => {
    expect(countOverlapDays('2024-01-01', '2024-01-10', '2025-01-01', '2025-06-01')).toBe(0)
  })

  it('counts both entry and exit day', () => {
    // 5-day trip: Jan 1 – Jan 5 = 5 days
    expect(countOverlapDays('2025-01-01', '2025-01-05', '2024-12-01', '2025-12-31')).toBe(5)
  })
})

describe('getDaysUsedInWindow', () => {
  it('returns 0 with no trips', () => {
    expect(getDaysUsedInWindow([], '2025-06-01')).toBe(0)
  })

  it('counts a simple past trip', () => {
    const trips = [trip('2025-04-01', '2025-04-30')] // 30 days
    expect(getDaysUsedInWindow(trips, '2025-06-01')).toBe(30)
  })

  it('ignores trips older than 180 days', () => {
    const trips = [trip('2024-01-01', '2024-02-01')] // far past
    expect(getDaysUsedInWindow(trips, '2025-06-01')).toBe(0)
  })

  it('clips trip that spans the window boundary', () => {
    // ref = 2025-06-01, window starts 2024-12-04
    // trip = 2024-11-01 to 2025-01-01 (in window from Dec 4 to Jan 1 = 29 days)
    const trips = [trip('2024-11-01', '2025-01-01')]
    const days = getDaysUsedInWindow(trips, '2025-06-01')
    expect(days).toBe(29)
  })

  it('sums multiple trips', () => {
    const trips = [
      trip('2025-04-01', '2025-04-15'), // 15 days
      trip('2025-05-01', '2025-05-20'), // 20 days
    ]
    expect(getDaysUsedInWindow(trips, '2025-06-01')).toBe(35)
  })

  it('excludes planned trips by default', () => {
    const trips = [trip('2025-05-01', '2025-05-10', true)]
    expect(getDaysUsedInWindow(trips, '2025-06-01')).toBe(0)
  })

  it('two trips totaling exactly 90 days', () => {
    const trips = [
      trip('2025-01-01', '2025-02-14'), // 45 days
      trip('2025-03-01', '2025-04-14'), // 45 days
    ]
    expect(getDaysUsedInWindow(trips, '2025-06-01')).toBe(90)
  })
})

describe('validatePlannedTrip', () => {
  it('allows a short trip with plenty of room', () => {
    const result = validatePlannedTrip([], '2025-06-01', '2025-06-10')
    expect(result.isValid).toBe(true)
  })

  it('blocks a trip that would exceed 90 days', () => {
    const existing = [
      trip('2025-04-01', '2025-05-30'), // 60 days
    ]
    // Adding 31 more days starting Jun 1
    const result = validatePlannedTrip(existing, '2025-06-01', '2025-07-01')
    expect(result.isValid).toBe(false)
    expect(result.firstViolationDate).toBeDefined()
    expect(result.maxSafeDays).toBe(30)
  })

  it('blocks a single trip longer than 90 days', () => {
    const result = validatePlannedTrip([], '2025-01-01', '2025-04-01')
    expect(result.isValid).toBe(false)
    expect(result.maxSafeDays).toBe(90)
  })

  it('allows a 90-day trip with nothing else in window', () => {
    const result = validatePlannedTrip([], '2025-01-01', '2025-03-31')
    expect(result.isValid).toBe(true)
  })

  it('detects violation on specific day when close to limit', () => {
    const existing = [
      trip('2025-03-01', '2025-05-28'), // 89 days
    ]
    // Adding a 3-day trip — day 2 would push to 91
    const result = validatePlannedTrip(existing, '2025-05-29', '2025-05-31')
    expect(result.isValid).toBe(false)
    expect(result.maxSafeDays).toBe(1)
  })
})

describe('getResetEvents', () => {
  it('returns empty array with no trips', () => {
    expect(getResetEvents([], '2025-06-01')).toHaveLength(0)
  })

  it('returns a release event 180 days after a trip day', () => {
    // Single-day trip on 2025-01-01 → release on 2025-07-01
    const trips = [trip('2025-01-01', '2025-01-01')]
    const events = getResetEvents(trips, '2025-06-01')
    expect(events).toHaveLength(1)
    expect(events[0].date).toBe('2025-06-30') // Jan 1 + 180 days = Jun 30
    expect(events[0].daysReleased).toBe(1)
  })

  it('excludes future trip from release calculation', () => {
    const trips = [trip('2026-01-01', '2026-01-10', false)]
    // future trip relative to our reference date
    const events = getResetEvents(trips, '2025-06-01')
    expect(events).toHaveLength(0)
  })
})

describe('getMaxConsecutiveDays', () => {
  it('returns 90 with no existing trips', () => {
    expect(getMaxConsecutiveDays([], '2025-06-01')).toBe(90)
  })

  it('returns reduced days when close to limit', () => {
    const existing = [
      trip('2025-04-01', '2025-05-29'), // 59 days
    ]
    // 31 more days are safe, 32nd would hit 91
    expect(getMaxConsecutiveDays(existing, '2025-06-01')).toBe(31)
  })
})

describe('tripsOverlap', () => {
  it('detects overlap', () => {
    expect(tripsOverlap('2025-01-01', '2025-01-10', '2025-01-08', '2025-01-15')).toBe(true)
  })

  it('detects non-overlap', () => {
    expect(tripsOverlap('2025-01-01', '2025-01-10', '2025-01-11', '2025-01-20')).toBe(false)
  })

  it('detects adjacent trips as non-overlapping', () => {
    // Jan 1–10 and Jan 11–20: no shared day
    expect(tripsOverlap('2025-01-01', '2025-01-10', '2025-01-11', '2025-01-20')).toBe(false)
  })

  it('detects same-day boundary overlap', () => {
    // Jan 1–10 and Jan 10–20: share Jan 10
    expect(tripsOverlap('2025-01-01', '2025-01-10', '2025-01-10', '2025-01-20')).toBe(true)
  })
})
