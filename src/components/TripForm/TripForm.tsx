import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { TripEntry } from '../../types'
import { ALL_COUNTRIES, COUNTRY_FLAGS, COUNTRY_ZONE } from '../../constants/countries'
import { validatePlannedTrip, getDaysUsedInWindow } from '../../utils/schengen'
import { today } from '../../utils/dateUtils'
import { differenceInDays, parseISO } from 'date-fns'

interface Props {
  open: boolean
  trip: TripEntry | null
  existingTrips: TripEntry[]
  initialDates?: { entryDate: string; exitDate: string }
  onSave: (data: Omit<TripEntry, 'id'>) => void
  onClose: () => void
}

interface FormData {
  entryDate: string
  exitDate: string
  country: string
  notes: string
}

function emptyForm(): FormData {
  return { entryDate: '', exitDate: '', country: '', notes: '' }
}

function tripToForm(t: TripEntry): FormData {
  return {
    entryDate: t.entryDate,
    exitDate: t.exitDate === 'ongoing' ? today() : t.exitDate,
    country: t.country,
    notes: t.notes ?? '',
  }
}

/* ─── Dropdown sub-components ────────────────────────────────────────────── */
function GroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: '0.375rem 0.75rem 0.25rem',
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--color-text-muted)',
    }}>
      {label}
    </div>
  )
}

interface OptionProps {
  c: { slug: string; flag: string }
  selected: boolean
  onSelect: (slug: string) => void
  label: string
}

function CountryOption({ c, selected, onSelect, label }: OptionProps) {
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onSelect(c.slug) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        cursor: 'pointer',
        background: selected ? 'rgba(59,130,246,0.08)' : 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = selected ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.06)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = selected ? 'rgba(59,130,246,0.08)' : 'transparent' }}
    >
      <span style={{ width: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)', fontSize: '0.75rem', fontWeight: 700 }}>
        {selected ? '✓' : ''}
      </span>
      <span style={{ flexShrink: 0, fontSize: '1.1rem', lineHeight: 1 }}>{c.flag}</span>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{label}</span>
    </div>
  )
}

/* ─── Searchable country combobox ────────────────────────────────────────── */
interface ComboboxProps {
  value: string
  onChange: (v: string) => void
  error?: boolean
}

function CountryCombobox({ value, onChange, error }: ComboboxProps) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const locale = i18n.language === 'uk' ? 'uk' : i18n.language === 'ru' ? 'ru' : 'en'
  const label = (c: { slug: string }) => t(`countries.${c.slug}`, { defaultValue: c.slug })
  const sortByLabel = (a: { slug: string }, b: { slug: string }) =>
    label(a).localeCompare(label(b), locale)

  const schengenGroup = ALL_COUNTRIES.filter((c) => c.zone === 'schengen').sort(sortByLabel)
  const otherGroup = ALL_COUNTRIES.filter((c) => c.zone !== 'schengen').sort(sortByLabel)

  const filtered = query
    ? ALL_COUNTRIES.filter((c) => label(c).toLowerCase().includes(query.toLowerCase())).sort(sortByLabel)
    : null

  const openDrop = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
    setIsOpen(true)
  }, [])

  const closeDrop = useCallback(() => {
    setIsOpen(false)
    setQuery('')
  }, [])

  const select = useCallback((slug: string) => {
    onChange(slug)
    closeDrop()
  }, [onChange, closeDrop])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) closeDrop()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, closeDrop])

  const displayValue = value
    ? `${COUNTRY_FLAGS[value] ?? ''} ${t(`countries.${value}`, { defaultValue: value })}`
    : ''

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 2rem 0.5rem 0.75rem',
    background: 'var(--color-bg)',
    border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
    borderRadius: '0.5rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    outline: 'none',
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : displayValue}
          readOnly={!isOpen}
          placeholder={isOpen ? t('form.searchCountry') : t('form.selectCountry')}
          onClick={openDrop}
          onFocus={openDrop}
          onChange={(e) => setQuery(e.target.value)}
          style={inputStyle}
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (isOpen ? closeDrop() : openDrop())}
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: '0.625rem',
            padding: '0.25rem',
            lineHeight: 1,
          }}
        >
          {isOpen ? '▲' : '▼'}
        </button>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropRef}
            style={{
              ...dropStyle,
              background: 'var(--color-surface-solid)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {filtered !== null && filtered.length === 0 ? (
              <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {t('form.noCountriesFound')}
              </div>
            ) : filtered !== null ? (
              filtered.map((c) => <CountryOption key={c.slug} c={c} selected={value === c.slug} onSelect={select} label={label(c)} />)
            ) : (
              <>
                <GroupHeader label={t('form.groupSchengen')} />
                {schengenGroup.map((c) => <CountryOption key={c.slug} c={c} selected={value === c.slug} onSelect={select} label={label(c)} />)}
                <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }} />
                <GroupHeader label={t('form.groupOther')} />
                {otherGroup.map((c) => <CountryOption key={c.slug} c={c} selected={value === c.slug} onSelect={select} label={label(c)} />)}
              </>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

/* ─── Main form ───────────────────────────────────────────────────────────── */
export default function TripForm({ open, trip, existingTrips, initialDates, onSave, onClose }: Props) {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const [form, setForm] = useState<FormData>(emptyForm())
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'general', string>>>({})

  useEffect(() => {
    if (open) {
      if (trip) {
        setForm(tripToForm(trip))
      } else if (initialDates) {
        setForm({ ...emptyForm(), entryDate: initialDates.entryDate, exitDate: initialDates.exitDate })
      } else {
        setForm(emptyForm())
      }
      setErrors({})
    }
  }, [open, trip, initialDates])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const set = (key: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const otherTrips = existingTrips.filter((t) => t.id !== trip?.id)
  const isSchengen = COUNTRY_ZONE[form.country] === 'schengen'
  const otherSchengenTrips = otherTrips.filter((t) => COUNTRY_ZONE[t.country] === 'schengen')
  const todayISO = today()

  const tripDays =
    form.entryDate && form.exitDate && form.entryDate <= form.exitDate
      ? differenceInDays(parseISO(form.exitDate), parseISO(form.entryDate)) + 1
      : 0

  const validationResult =
    isSchengen && form.entryDate && form.exitDate && form.entryDate <= form.exitDate
      ? validatePlannedTrip(otherSchengenTrips.filter((t) => t.entryDate <= todayISO), form.entryDate, form.exitDate)
      : null

  const windowTotal =
    isSchengen && form.entryDate && form.exitDate && form.entryDate <= form.exitDate
      ? getDaysUsedInWindow(
          [...otherSchengenTrips, { id: '__preview', entryDate: form.entryDate, exitDate: form.exitDate, country: form.country }],
          todayISO
        )
      : null

  // Hard error: overlap of 2+ days with any other trip (1-day shared transit is allowed)
  const overlapError = !!(form.entryDate && form.exitDate && form.entryDate <= form.exitDate &&
    otherTrips.some((other) => {
      const otherExit = other.exitDate === 'ongoing' ? todayISO : other.exitDate
      const overlapStart = form.entryDate > other.entryDate ? form.entryDate : other.entryDate
      const overlapEnd = form.exitDate < otherExit ? form.exitDate : otherExit
      // overlapEnd > overlapStart means ≥2 days overlap; overlapEnd === overlapStart means 1-day transit (allowed)
      return overlapEnd > overlapStart
    })
  )

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.entryDate) e.entryDate = t('form.errors.entryRequired')
    if (!form.exitDate) e.exitDate = t('form.errors.exitRequired')
    if (!form.country) e.country = t('form.errors.countryRequired')
    if (form.entryDate && form.exitDate && form.exitDate < form.entryDate)
      e.exitDate = t('form.errors.exitBeforeEntry')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSave({
      entryDate: form.entryDate,
      exitDate: form.exitDate,
      country: form.country,
      notes: form.notes || undefined,
    })
  }

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  }

  const inputStyle = (hasError?: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: 'var(--color-bg)',
    border: `1px solid ${hasError ? 'var(--color-danger)' : 'var(--color-border)'}`,
    borderRadius: '0.5rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
  })

  const errorStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: 'var(--color-danger)',
    marginTop: '0.125rem',
  }

  return open ? (
    <>
      {/* Backdrop */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 49,
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={trip ? t('form.editTitle') : t('form.addTitle')}
        style={{
          position: 'fixed', inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          padding: '1rem',
        }}
      >
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            pointerEvents: 'auto',
            background: 'var(--color-surface-solid)',
            border: '1px solid var(--color-border)',
            borderRadius: '1rem',
            padding: 'clamp(1rem, 5vw, 1.5rem)',
            width: '100%',
            maxWidth: 'min(480px, calc(100vw - 32px))',
            boxSizing: 'border-box',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxHeight: '90dvh',
            overflowY: 'auto',
          }}
        >
          <h2 style={{ color: 'var(--color-text)', fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem' }}>
            {trip ? t('form.editTitle') : t('form.addTitle')}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Country — searchable combobox */}
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('form.country')}</label>
              <CountryCombobox
                value={form.country}
                onChange={(v) => set('country', v)}
                error={!!errors.country}
              />
              {errors.country && <p style={errorStyle}>{errors.country}</p>}
            </div>

            {/* Entry date */}
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('form.entryDate')}</label>
              <input
                type="date"
                value={form.entryDate}
                onChange={(e) => set('entryDate', e.target.value)}
                style={inputStyle(!!errors.entryDate)}
              />
              {errors.entryDate && <p style={errorStyle}>{errors.entryDate}</p>}
            </div>

            {/* Exit date */}
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('form.exitDate')}</label>
              <input
                type="date"
                value={form.exitDate}
                min={form.entryDate}
                onChange={(e) => set('exitDate', e.target.value)}
                style={inputStyle(!!errors.exitDate)}
              />
              {errors.exitDate && <p style={errorStyle}>{errors.exitDate}</p>}
            </div>

            {/* Overlap error — blocks saving */}
            {overlapError && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--color-danger)', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-danger)' }}>
                {t('form.errorOverlap')}
              </div>
            )}

            {/* Notes */}
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('form.notes')}</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder={t('form.notesPlaceholder')}
                style={inputStyle()}
              />
            </div>

            {/* >90 day warning — Schengen only */}
            {isSchengen && tripDays > 90 && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.12)', border: '1px solid var(--color-warning)', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-warning)' }}>
                {t('form.warningLong')}
              </div>
            )}

            {/* Live Schengen window preview */}
            {isSchengen && tripDays > 0 && tripDays <= 90 && windowTotal !== null && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {t('form.preview', { days: tripDays, total: windowTotal })}
              </div>
            )}

            {/* 90/180 violation warning — Schengen only */}
            {isSchengen && validationResult && !validationResult.isValid && tripDays <= 90 && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-danger)' }}>
                {t('form.warning', { date: validationResult.firstViolationDate ?? '—', max: validationResult.maxSafeDays ?? 0 })}
              </div>
            )}

            {errors.general && <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-danger)' }}>{errors.general}</p>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                {t('form.cancel')}
              </button>
              <button
                type="submit"
                disabled={overlapError}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, background: 'var(--color-accent)', border: 'none', color: '#fff', cursor: overlapError ? 'not-allowed' : 'pointer', opacity: overlapError ? 0.45 : 1 }}
              >
                {t('form.save')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  ) : null
}
