import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { TripEntry, TripValidationResult } from '../../types'
import { validatePlannedTrip, getDaysUsedInWindow } from '../../utils/schengen'
import { formatDate } from '../../utils/dateUtils'

interface Props {
  trips: TripEntry[]
  onAddTrip: (trip: Omit<TripEntry, 'id'>) => void
}

export default function TripChecker({ trips, onAddTrip }: Props) {
  const { t, i18n } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [result, setResult] = useState<(TripValidationResult & { daysInWindow?: number }) | null>(null)

  const nonPlanned = trips.filter((t) => !t.isPlanned)

  const handleCheck = () => {
    if (!startDate || !endDate || endDate < startDate) return
    const validation = validatePlannedTrip(nonPlanned, startDate, endDate)
    const daysInWindow = validation.isValid
      ? getDaysUsedInWindow(
          [...nonPlanned, { id: '__check', entryDate: startDate, exitDate: endDate, country: '' }],
          endDate
        )
      : undefined
    setResult({ ...validation, daysInWindow })
  }

  const handleAddTrip = () => {
    if (!startDate || !endDate) return
    onAddTrip({ entryDate: startDate, exitDate: endDate, country: 'france', isPlanned: true })
    setResult(null)
    setStartDate('')
    setEndDate('')
  }

  return (
    <section className="glass-card p-5">
      <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
        {t('checker.title')}
      </h2>
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
        {t('checker.subtitle')}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('checker.startDate')}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setResult(null) }}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              color: 'var(--color-text)',
              fontSize: '0.875rem',
            }}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('checker.endDate')}
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => { setEndDate(e.target.value); setResult(null) }}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              color: 'var(--color-text)',
              fontSize: '0.875rem',
            }}
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={!startDate || !endDate || endDate < startDate}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            cursor: startDate && endDate ? 'pointer' : 'not-allowed',
            opacity: startDate && endDate && endDate >= startDate ? 1 : 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          {t('checker.check')}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
            className="mt-4 rounded-lg px-4 py-3"
            style={{
              background: result.isValid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${result.isValid ? 'var(--color-success)' : 'var(--color-danger)'}`,
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{ color: result.isValid ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
              {result.isValid
                ? t('checker.safe', { days: result.daysInWindow ?? '—' })
                : t('checker.violation', {
                    date: result.firstViolationDate
                      ? formatDate(result.firstViolationDate, i18n.language)
                      : '—',
                    max: result.maxSafeDays ?? 0,
                  })}
            </p>
            {result.isValid && (
              <button
                onClick={handleAddTrip}
                className="mt-2 text-xs font-semibold"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {t('checker.addTrip')}
              </button>
            )}
          </motion.div>
        )}
        {!result && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('checker.noResult')}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  )
}
