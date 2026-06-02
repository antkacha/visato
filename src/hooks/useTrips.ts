import { useState, useEffect, useCallback } from 'react'
import type { TripEntry } from '../types'
import { loadTrips, saveTrips, validateImportedTrips } from '../utils/storage'
import { today } from '../utils/dateUtils'

export function useTrips() {
  const [trips, setTrips] = useState<TripEntry[]>(loadTrips)

  useEffect(() => {
    saveTrips(trips)
  }, [trips])

  const addTrip = useCallback((trip: Omit<TripEntry, 'id'>) => {
    const newTrip: TripEntry = { ...trip, id: crypto.randomUUID() }
    setTrips((prev) => [...prev, newTrip])
  }, [])

  const updateTrip = useCallback((id: string, updates: Partial<TripEntry>) => {
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }, [])

  const deleteTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const exportTrips = useCallback(() => {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schengen-trips-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [trips])

  const importTrips = useCallback((file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string)
          const validated = validateImportedTrips(parsed)
          setTrips(validated)
          resolve(validated.length)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }, [])

  return { trips, addTrip, updateTrip, deleteTrip, exportTrips, importTrips }
}
