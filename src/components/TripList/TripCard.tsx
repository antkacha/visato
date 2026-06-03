import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import type { TripEntry } from '../../types'
import { formatDate, getTripStatus, today } from '../../utils/dateUtils'
import { COUNTRY_FLAGS } from '../../constants/countries'
import { differenceInDays, parseISO } from 'date-fns'

interface Props {
  trip: TripEntry
  onEdit: (trip: TripEntry) => void
  onDelete: (id: string) => void
}

function getTripDays(trip: TripEntry): number {
  const todayISO = today()
  const exit = trip.exitDate === 'ongoing' ? todayISO : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

export default function TripCard({ trip, onEdit, onDelete }: Props) {
  const { t, i18n } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const [showConfirm, setShowConfirm] = useState(false)
  const days = getTripDays(trip)
  const label = getTripStatus(trip, today())
  const flag = COUNTRY_FLAGS[trip.country] ?? '🏳️'
  const countryName = t(`countries.${trip.country}`, { defaultValue: trip.country })
  const isViolation = days > 90 && label !== 'planned'

  const exitDisplay = label === 'ongoing' && trip.exitDate === 'ongoing'
    ? t('trips.ongoing')
    : formatDate(trip.exitDate === 'ongoing' ? today() : trip.exitDate, i18n.language)
  const tripDates = `${formatDate(trip.entryDate, i18n.language)} – ${exitDisplay}`

  const labelColors: Record<string, { bg: string; color: string }> = {
    ongoing: { bg: 'rgba(45,191,138,0.15)', color: '#2DBF8A' },
    planned: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    past:    { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
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
        border: label === 'planned' ? '1.5px dashed var(--color-border)' : '1px solid var(--color-border)',
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
          {tripDates}
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
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'transparent', border: '1px solid var(--color-border)', cursor: 'pointer', color: '#6B7280' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1A7A59')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          title={t('trips.delete')}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'transparent', border: '1px solid var(--color-border)', cursor: 'pointer', color: '#6B7280' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1A7A59')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>

    {showConfirm && createPortal(
      <>
        {/* Backdrop */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          onClick={() => setShowConfirm(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 60,
          }}
        />
        {/* Dialog */}
        <div
          style={{
            position: 'fixed', inset: 0,
            zIndex: 61,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            pointerEvents: 'none',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              pointerEvents: 'auto',
              background: 'var(--color-surface-solid)',
              border: '1px solid var(--color-border)',
              borderRadius: '1rem',
              padding: '1.75rem 1.5rem 1.5rem',
              width: '100%',
              maxWidth: '340px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              textAlign: 'center',
            }}
          >
            {/* Icon */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              marginBottom: '1rem',
            }}>
              <Trash2 size={22} style={{ color: 'var(--color-danger)' }} />
            </div>

            {/* Title */}
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {t('trips.confirmDelete')}
            </h3>

            {/* Trip details */}
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              {flag} {countryName}
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {tripDates}
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1, padding: '0.5rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem', fontWeight: 600,
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                {t('form.cancel')}
              </button>
              <button
                onClick={() => { setShowConfirm(false); onDelete(trip.id) }}
                style={{
                  flex: 1, padding: '0.5rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem', fontWeight: 600,
                  background: 'var(--color-danger)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {t('trips.deleteConfirm')}
              </button>
            </div>
          </motion.div>
        </div>
      </>,
      document.body
    )}
  )
}
