import { useMemo } from 'react'
import type { TripEntry, SchengenStatus } from '../types'
import {
  getDaysUsedInWindow,
  getResetEvents,
  getMaxConsecutiveDays,
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

    // For max consecutive days: start from tomorrow and treat ongoing trips as
    // ending today — otherwise their future days double-count with the hypothetical
    // new trip, significantly underestimating available capacity.
    const tomorrowISO = format(addDays(parseISO(todayISO), 1), 'yyyy-MM-dd')
    const tripsForMax = trips.map((t) =>
      t.exitDate === 'ongoing' ? { ...t, exitDate: todayISO } : t
    )
    const maxConsecutiveDays = getMaxConsecutiveDays(tripsForMax, tomorrowISO)

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
