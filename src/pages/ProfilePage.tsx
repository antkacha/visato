import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { differenceInDays, parseISO } from 'date-fns'
import type { User } from '@supabase/supabase-js'
import type { TripEntry } from '../types'
import { ALL_COUNTRIES, COUNTRY_FLAGS } from '../constants/countries'
import { loadProfile, saveProfile } from '../utils/storage'
import { today } from '../utils/dateUtils'

interface Props {
  user: User | null
  trips: TripEntry[]
}

function tripDays(trip: TripEntry): number {
  const exit = trip.exitDate === 'ongoing' ? today() : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' }

export default function ProfilePage({ user, trips }: Props) {
  const { t, i18n } = useTranslation()

  const [displayName, setDisplayName] = useState('')
  const [homeCountry, setHomeCountry] = useState('')
  const [bio, setBio] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = loadProfile()
    setDisplayName(stored.displayName || (user?.user_metadata?.full_name as string | undefined) || '')
    setHomeCountry(stored.homeCountry || '')
    setBio(stored.bio || '')
  }, [user])

  const handleSave = () => {
    saveProfile({ displayName, homeCountry, bio })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Travel stats ──────────────────────────────────────────────────────────
  const uniqueCountries = useMemo(() => new Set(trips.map((t) => t.country)).size, [trips])
  const totalDays = useMemo(() => trips.reduce((s, t) => s + tripDays(t), 0), [trips])
  const topCountry = useMemo((): [string, number] | null => {
    const by: Record<string, number> = {}
    for (const t of trips) by[t.country] = (by[t.country] ?? 0) + tripDays(t)
    const entries = Object.entries(by).sort(([, a], [, b]) => b - a)
    return entries[0] ?? null
  }, [trips])

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(
        LOCALE_MAP[i18n.language] ?? 'en-US',
        { month: 'long', year: 'numeric' },
      )
    : null

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 2px 16px var(--color-shadow)',
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-text)',
    marginBottom: '0.375rem',
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box',
    outline: 'none',
  }

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{
        background: 'var(--color-bg)', minHeight: 'calc(100dvh - 56px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-muted)', fontSize: '0.9375rem',
      }}>
        {t('profile.signInRequired')}
      </div>
    )
  }

  const avatar   = user.user_metadata?.avatar_url as string | undefined
  const fullName = (user.user_metadata?.full_name ?? user.email ?? '') as string
  const email    = user.email ?? ''

  const statCards = [
    { label: t('profile.stats.countries'), value: uniqueCountries },
    { label: t('profile.stats.trips'),     value: trips.length },
    { label: t('profile.stats.days'),      value: totalDays },
    {
      label: t('profile.stats.topCountry'),
      value: topCountry
        ? `${COUNTRY_FLAGS[topCountry[0]] ?? ''} ${t(`countries.${topCountry[0]}`, { defaultValue: topCountry[0] })}`
        : t('profile.noTopCountry'),
      small: true,
    },
  ]

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: 'calc(100dvh - 56px)', padding: '2rem 1.25rem' }}>
      <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── User card ──────────────────────────────────────────────────── */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {avatar ? (
            <img
              src={avatar} alt={fullName}
              style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
              background: '#2DBF8A', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 800,
            }}>
              {fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{
              fontSize: '1.375rem', fontWeight: 800, color: 'var(--color-heading)',
              lineHeight: 1.2, marginBottom: '0.3rem',
            }}>
              {fullName}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
              {email}
            </div>
            {memberSince && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('profile.memberSince')} {memberSince}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((s, i) => (
            <div key={i} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.875rem',
              padding: '1.125rem 1rem',
              boxShadow: '0 2px 8px var(--color-shadow)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.375rem', textAlign: 'center',
            }}>
              <div style={{
                fontSize: s.small ? '1rem' : '1.75rem',
                fontWeight: 800, color: '#2DBF8A',
                lineHeight: 1, letterSpacing: s.small ? 0 : '-0.02em',
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500, lineHeight: 1.3 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Personal info form ─────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-heading)', marginBottom: '1.25rem' }}>
            {t('profile.personal.title')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Display name */}
            <div>
              <label style={fieldLabel}>{t('profile.personal.displayName')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputBase}
              />
            </div>

            {/* Home country */}
            <div>
              <label style={fieldLabel}>{t('profile.personal.homeCountry')}</label>
              <select
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                style={inputBase}
              >
                <option value="">{t('profile.personal.homeCountryPlaceholder')}</option>
                {ALL_COUNTRIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.flag} {t(`countries.${c.slug}`, { defaultValue: c.slug.replace(/_/g, ' ') })}
                  </option>
                ))}
              </select>
            </div>

            {/* Bio */}
            <div>
              <label style={fieldLabel}>{t('profile.personal.bio')}</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('profile.personal.bioPlaceholder')}
                rows={3}
                style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* Save */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
              <button
                onClick={handleSave}
                style={{
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: saved ? '#1EA876' : '#2DBF8A',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  minWidth: '9rem',
                }}
              >
                {saved ? t('profile.personal.saved') : t('profile.personal.save')}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
