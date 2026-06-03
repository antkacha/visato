import { AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { TripEntry } from '../../types'
import TripCard from './TripCard'
import { getTripStatus, today } from '../../utils/dateUtils'

interface Props {
  trips: TripEntry[]
  onAdd: () => void
  onEdit: (trip: TripEntry) => void
  onDelete: (id: string) => void
}

export default function TripList({ trips, onAdd, onEdit, onDelete }: Props) {
  const { t } = useTranslation()

  const todayISO = today()
  const STATUS_ORDER = { ongoing: 0, planned: 1, past: 2 }
  const sorted = [...trips].sort((a, b) => {
    const sa = getTripStatus(a, todayISO)
    const sb = getTripStatus(b, todayISO)
    if (sa !== sb) return STATUS_ORDER[sa] - STATUS_ORDER[sb]
    return b.entryDate.localeCompare(a.entryDate)
  })

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('trips.title')}
        </h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>+</span> {t('trips.add')}
        </button>
      </div>

      {trips.length === 0 ? (
        <div
          className="glass-card p-8 text-center"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <p className="text-4xl mb-3">✈️</p>
          <p className="text-sm">{t('trips.empty')}</p>
          <button
            onClick={onAdd}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t('trips.add')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {sorted.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}
