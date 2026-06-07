import { differenceInDays, parseISO, getMonth, getYear } from 'date-fns'
import type { TripEntry } from '../types'
import { ACHIEVEMENTS } from '../constants/achievements'

function tripDays(trip: TripEntry): number {
  const exit = trip.exitDate === 'ongoing' ? new Date().toISOString().slice(0, 10) : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

export interface EvaluatedAchievement {
  id: string
  emoji: string
  color: string
  unlocked: boolean
  progress: number // 0..1
  current: number
  target: number
}

export function getAchievements(trips: TripEntry[]): EvaluatedAchievement[] {
  const countrySet = new Set(trips.map((t) => t.country))
  const unique = countrySet.size
  const total = trips.length
  const totalDays = trips.reduce((sum, t) => sum + tripDays(t), 0)

  const tripsByYear: Record<number, number> = {}
  for (const t of trips) {
    const y = getYear(parseISO(t.entryDate))
    tripsByYear[y] = (tripsByYear[y] ?? 0) + 1
  }
  const maxTripsInYear = Object.values(tripsByYear).length > 0
    ? Math.max(...Object.values(tripsByYear))
    : 0

  const tripsByCountry: Record<string, number> = {}
  for (const t of trips) {
    tripsByCountry[t.country] = (tripsByCountry[t.country] ?? 0) + 1
  }
  const maxCountryVisits = Object.values(tripsByCountry).length > 0
    ? Math.max(...Object.values(tripsByCountry))
    : 0

  const months = new Set<number>()
  for (const t of trips) months.add(getMonth(parseISO(t.entryDate)))
  const hasSummer = months.has(5) || months.has(6) || months.has(7)
  const hasWinter = months.has(11) || months.has(0)

  const alpsCount    = ['switzerland', 'austria', 'italy'].filter((c) => countrySet.has(c)).length
  const medCount     = ['italy', 'spain', 'france', 'greece', 'croatia', 'portugal'].filter((c) => countrySet.has(c)).length
  const nordicCount  = ['sweden', 'norway', 'finland', 'denmark', 'iceland', 'estonia', 'latvia', 'lithuania'].filter((c) => countrySet.has(c)).length
  const eeuropeCount = ['poland', 'czech_republic', 'hungary', 'romania', 'bulgaria', 'slovakia'].filter((c) => countrySet.has(c)).length

  return ACHIEVEMENTS.map((a) => {
    let unlocked = false
    let current = 0
    let target = 1

    switch (a.id) {
      case 'first-trip':
        target = 1; current = Math.min(total, 1); unlocked = total >= 1; break
      case 'mapper':
        target = 5; current = Math.min(total, 5); unlocked = total >= 5; break
      case 'regular':
        target = 3; current = Math.min(maxTripsInYear, 3); unlocked = maxTripsInYear >= 3; break
      case 'beginner':
        target = 3; current = Math.min(unique, 3); unlocked = unique >= 3; break
      case 'explorer':
        target = 10; current = Math.min(unique, 10); unlocked = unique >= 10; break
      case 'adventurer':
        target = 25; current = Math.min(unique, 25); unlocked = unique >= 25; break
      case 'globetrotter':
        target = 50; current = Math.min(unique, 50); unlocked = unique >= 50; break
      case 'one-month':
        target = 30; current = Math.min(totalDays, 30); unlocked = totalDays >= 30; break
      case 'long-haul':
        target = 90; current = Math.min(totalDays, 90); unlocked = totalDays >= 90; break
      case 'nomad':
        target = 180; current = Math.min(totalDays, 180); unlocked = totalDays >= 180; break
      case 'alps-lover':
        target = 3; current = alpsCount; unlocked = alpsCount === 3; break
      case 'mediterranean':
        target = 3; current = Math.min(medCount, 3); unlocked = medCount >= 3; break
      case 'nordic':
        target = 3; current = Math.min(nordicCount, 3); unlocked = nordicCount >= 3; break
      case 'eastern-europe':
        target = 3; current = Math.min(eeuropeCount, 3); unlocked = eeuropeCount >= 3; break
      case 'summer-escape':
        target = 1; current = hasSummer ? 1 : 0; unlocked = hasSummer; break
      case 'winter-traveller':
        target = 1; current = hasWinter ? 1 : 0; unlocked = hasWinter; break
      case 'loyal':
        target = 3; current = Math.min(maxCountryVisits, 3); unlocked = maxCountryVisits >= 3; break
    }

    return { ...a, unlocked, progress: current / target, current, target }
  })
}
