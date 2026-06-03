import { useMemo } from 'react'
import type { TripEntry, SchengenStatus } from '../types'
import {
  getDaysUsedInWindow,
  getResetEvents,
} from '../utils/schengen'
import { today } from '../utils/dateUtils'
import { addDays, format, parseISO } from 'date-fns'

export function useSchengen(trips: TripEntry[]): SchengenStatus {
  return useMemo(() => {
    const todayISO = today()
    const daysUsed = getDaysUsedInWindow(trips, todayISO)
    const daysRemaining = Math.max(0, 90 - daysUsed)
    const windowStart = format(addDays(parseISO(todayISO), -179), 'yyyy-MM-dd')
    const resets = getResetEvents(trips, todayISO)

    // maxConsecutiveDays = days remaining in the current 90-day quota.
    // Using daysRemaining directly ensures it is always consistent with daysUsed
    // (maxConsecutiveDays + daysUsed never exceeds 90).
    // The iterative rolling-window approach allowed values > 90-daysUsed by counting
    // future days of ongoing trips AND a hypothetical new trip simultaneously.
    const maxConsecutiveDays = daysRemaining

    return {
      daysUsed,
      daysRemaining,
      windowStart,
      windowEnd: todayISO,
      maxConsecutiveDays,
      resets,
      isOverLimit: daysUsed > 90,
    }
  }, [trips])
}
