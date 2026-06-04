import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import type { TripEntry } from '../types'
import { loadTrips, saveTrips, validateImportedTrips } from '../utils/storage'
import { today } from '../utils/dateUtils'
import { supabase } from '../lib/supabase'

// ── DB ↔ local conversion ─────────────────────────────────────────────────

interface DbTrip {
  id: string
  user_id: string
  entry_date: string
  exit_date: string
  country: string
  notes: string | null
  is_planned: boolean
}

function toDb(trip: TripEntry, userId: string): DbTrip {
  return {
    id: trip.id,
    user_id: userId,
    entry_date: trip.entryDate,
    exit_date: trip.exitDate,
    country: trip.country,
    notes: trip.notes ?? null,
    is_planned: trip.isPlanned ?? false,
  }
}

function fromDb(row: DbTrip): TripEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    exitDate: row.exit_date,
    country: row.country,
    notes: row.notes ?? undefined,
    isPlanned: row.is_planned || undefined,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useTrips(user: User | null) {
  const [trips, setTrips] = useState<TripEntry[]>(loadTrips)
  const [syncing, setSyncing] = useState(false)
  const syncedUid = useRef<string | null>(null)

  // Persist to localStorage on every change
  useEffect(() => {
    saveTrips(trips)
  }, [trips])

  // On sign-out: wipe trips from state and localStorage immediately
  useEffect(() => {
    if (!user) {
      setTrips([])
      saveTrips([])
      syncedUid.current = null
    }
  }, [user])

  // On sign-in: clear any stale local data, then load this user's trips from Supabase
  useEffect(() => {
    if (!supabase || !user || syncedUid.current === user.id) return
    syncedUid.current = user.id
    const db = supabase

    const loadFromCloud = async () => {
      setSyncing(true)
      // Clear before fetching so stale trips are never visible
      setTrips([])
      saveTrips([])
      try {
        const { data, error } = await db
          .from('trips')
          .select('*')
          .eq('user_id', user.id)

        if (error) throw error

        const cloudTrips = (data as DbTrip[]).map(fromDb)
        setTrips(cloudTrips)
      } catch (err) {
        console.error('[sync] load failed:', err)
      } finally {
        setSyncing(false)
      }
    }

    loadFromCloud()
  }, [user?.id])

  // ── CRUD ────────────────────────────────────────────────────────────────

  const addTrip = useCallback(
    (trip: Omit<TripEntry, 'id'>) => {
      const newTrip: TripEntry = { ...trip, id: crypto.randomUUID() }
      setTrips((prev) => [...prev, newTrip])
      if (supabase && user) {
        supabase
          .from('trips')
          .insert(toDb(newTrip, user.id))
          .then(({ error }) => { if (error) console.error('[sync] addTrip:', error) })
      }
    },
    [user]
  )

  const updateTrip = useCallback(
    (id: string, updates: Partial<TripEntry>) => {
      let updated: TripEntry | undefined
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t
          updated = { ...t, ...updates }
          return updated
        })
      )
      if (supabase && user && updated) {
        supabase
          .from('trips')
          .update(toDb(updated, user.id))
          .eq('id', id)
          .then(({ error }) => { if (error) console.error('[sync] updateTrip:', error) })
      }
    },
    [user]
  )

  const deleteTrip = useCallback(
    (id: string) => {
      setTrips((prev) => prev.filter((t) => t.id !== id))
      if (supabase && user) {
        supabase
          .from('trips')
          .delete()
          .eq('id', id)
          .then(({ error }) => { if (error) console.error('[sync] deleteTrip:', error) })
      }
    },
    [user]
  )

  // ── Export / Import ──────────────────────────────────────────────────────

  const exportTrips = useCallback(() => {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schengen-trips-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [trips])

  const importTrips = useCallback(
    (file: File): Promise<number> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target?.result as string)
            const validated = validateImportedTrips(parsed)
            setTrips(validated)
            // Upload imported trips to cloud if logged in
            if (supabase && user) {
              supabase
                .from('trips')
                .upsert(validated.map((t) => toDb(t, user.id)))
                .then(({ error }) => { if (error) console.error('[sync] importTrips:', error) })
            }
            resolve(validated.length)
          } catch (err) {
            reject(err)
          }
        }
        reader.onerror = reject
        reader.readAsText(file)
      })
    },
    [user]
  )

  return { trips, syncing, addTrip, updateTrip, deleteTrip, exportTrips, importTrips }
}
