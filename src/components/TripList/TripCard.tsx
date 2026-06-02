import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { TripEntry } from '../../types'
import { formatDate } from '../../utils/dateUtils'
import { COUNTRY_FLAGS } from '../../constants/countries'
import { differenceInDays, parseISO } from 'date-fns'
import { today } from '../../utils/dateUtils'

interface Props {
  trip: TripEntry
  onEdit: (trip: TripEntry) => void
  onDelete: (id: string) => void
}

function getTripDays(trip: TripEntry): number {
  const exit = trip.exitDate === 'ongoing' ? today() : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

function getTripLabel(trip: TripEntry): 'past' | 'planned' | 'ongoing' {
  if (trip.exitDate === 'ongoing') return 'ongoing'
  if (trip.isPlanned) return 'planned'
  return 'past'
}

export default function TripCard({ trip, onEdit, onDelete }: Props) {
  const { t, i18n } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const days = getTripDays(trip)
  const label = getTripLabel(trip)
  const flag = COUNTRY_FLAGS[trip.country] ?? '🏳️'
  const countryName = t(`countries.${trip.country}`, { defaultValue: trip.country })
  const isViolation = days > 90 && label !== 'planned'

  const handleDelete = () => {
    if (confirm(t('trips.confirmDelete'))) {
      onDelete(trip.id)
    }
  }

  const labelColors: Record<string, { bg: string; color: string }> = {
    past: { bg: 'var(--color-border)', color: 'var(--color-text-muted)' },
    planned: { bg: 'rgba(58,130,246,0.15)', color: 'var(--color-accent)' },
    ongoing: { bg: 'rgba(16,185,129,0.15)', color: 'var(--color-success)' },
  }
  const lc = labelColors[label]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25 }}
      style={{
        background: 'var(--color-surface)',
        border: trip.isPlanned ? '1.5px dashed var(--color-border)' : '1px solid var(--color-border)',
        borderRadius: '0.75rem',
        padding: '0.875rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      {/* Flag */}
      <span className="text-2xl leading-none shrink-0">{flag}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
            {countryName}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: lc.bg, color: lc.color }}
          >
            {t(`trips.${label}`)}
          </span>
          {isViolation && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)' }}
            >
              {t('trips.violation')}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {formatDate(trip.entryDate, i18n.language)} –{' '}
          {trip.exitDate === 'ongoing'
            ? t('trips.ongoing')
            : formatDate(trip.exitDate, i18n.language)}
        </p>
        {trip.notes && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {trip.notes}
          </p>
        )}
      </div>

      {/* Days badge */}
      <span
        className="text-sm font-bold tabular-nums shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {days}d
      </span>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onEdit(trip)}
          title={t('trips.edit')}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
          }}
        >
          ✏️
        </button>
        <button
          onClick={handleDelete}
          title={t('trips.delete')}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            color: 'var(--color-danger)',
          }}
        >
          🗑
        </button>
      </div>
    </motion.div>
  )
}
