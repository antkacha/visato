import { useState, useEffect, useMemo, useRef } from 'react'
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

function CameraIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

export default function ProfilePage({ user, trips }: Props) {
  const { t, i18n } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [homeCountry, setHomeCountry]  = useState('')
  const [bio, setBio]                  = useState('')
  const [localAvatar, setLocalAvatar]  = useState<string | null>(null)
  const [saved, setSaved]              = useState(false)

  // Load persisted profile
  useEffect(() => {
    const stored = loadProfile()
    const name = (user?.user_metadata?.full_name ?? user?.email ?? '') as string
    setDisplayName(stored.displayName || name)
    setHomeCountry(stored.homeCountry || '')
    setBio(stored.bio || '')
    if (stored.photoUrl) setLocalAvatar(stored.photoUrl)
  }, [user])

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setLocalAvatar(dataUrl)
      saveProfile({ displayName, homeCountry, bio, photoUrl: dataUrl })
    }
    reader.readAsDataURL(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  // ── Save form ─────────────────────────────────────────────────────────────
  const handleSave = () => {
    saveProfile({ displayName, homeCountry, bio, photoUrl: localAvatar ?? undefined })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const uniqueCountries = useMemo(() => new Set(trips.map((t) => t.country)).size, [trips])
  const totalDays       = useMemo(() => trips.reduce((s, t) => s + tripDays(t), 0), [trips])
  const topCountry      = useMemo((): [string, number] | null => {
    const by: Record<string, number> = {}
    for (const t of trips) by[t.country] = (by[t.country] ?? 0) + tripDays(t)
    const entries = Object.entries(by).sort(([, a], [, b]) => b - a)
    return entries[0] ?? null
  }, [trips])

  // ── Countries sorted by current locale ───────────────────────────────────
  const locale = i18n.language === 'uk' ? 'uk' : i18n.language === 'ru' ? 'ru' : 'en'
  const sortedCountries = useMemo(
    () =>
      [...ALL_COUNTRIES].sort((a, b) =>
        t(`countries.${a.slug}`, { defaultValue: a.slug })
          .localeCompare(t(`countries.${b.slug}`, { defaultValue: b.slug }), locale),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language],
  )

  // ── Member since ──────────────────────────────────────────────────────────
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(
        LOCALE_MAP[i18n.language] ?? 'en-US',
        { month: 'long', year: 'numeric' },
      )
    : null

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{
        background: 'var(--color-section)', minHeight: 'calc(100dvh - 56px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-muted)', fontSize: '0.9375rem',
      }}>
        {t('profile.signInRequired')}
      </div>
    )
  }

  const googleAvatar = user.user_metadata?.avatar_url as string | undefined
  const displayAvatar = localAvatar || googleAvatar
  const fullName = (user.user_metadata?.full_name ?? user.email ?? '') as string
  const email = user.email ?? ''

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    marginBottom: '0.375rem',
    letterSpacing: '0.01em',
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '0.5625rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const statCards = [
    { label: t('profile.stats.countries'), value: uniqueCountries, isString: false },
    { label: t('profile.stats.trips'),     value: trips.length,    isString: false },
    { label: t('profile.stats.days'),      value: totalDays,       isString: false },
    {
      label: t('profile.stats.topCountry'),
      value: topCountry
        ? `${COUNTRY_FLAGS[topCountry[0]] ?? ''} ${t(`countries.${topCountry[0]}`, { defaultValue: topCountry[0] })}`
        : t('profile.noTopCountry'),
      isString: true,
    },
  ]

  return (
    <div style={{ background: 'var(--color-section)', minHeight: 'calc(100dvh - 56px)', padding: '2rem 1.25rem' }}>
      <div style={{ maxWidth: '44rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── User header card ───────────────────────────────────────────── */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>

          {/* Avatar with photo-change overlay */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {displayAvatar ? (
              <img
                src={displayAvatar} alt={fullName}
                style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: '#2DBF8A', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.25rem', fontWeight: 800,
              }}>
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Camera overlay button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title={t('profile.changePhoto')}
              style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 26, height: 26, borderRadius: '50%',
                background: '#2DBF8A', border: '2px solid var(--color-surface)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <CameraIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>

          {/* Name / email / member since */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '1.375rem', fontWeight: 800, color: 'var(--color-heading)',
              lineHeight: 1.2, marginBottom: '0.25rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {fullName}
            </div>
            <div style={{
              fontSize: '0.875rem', color: 'var(--color-text-muted)',
              marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
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
              padding: '1.125rem 0.875rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.3rem', textAlign: 'center',
            }}>
              <div style={{
                fontSize: s.isString ? '0.9375rem' : '1.75rem',
                fontWeight: 800,
                color: '#2DBF8A',
                lineHeight: 1,
                letterSpacing: s.isString ? 0 : '-0.02em',
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
          <div style={{
            fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-heading)',
            marginBottom: '1.25rem',
          }}>
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

            {/* Home country — sorted alphabetically by current locale */}
            <div>
              <label style={fieldLabel}>{t('profile.personal.homeCountry')}</label>
              <select
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                style={inputBase}
              >
                <option value="">{t('profile.personal.homeCountryPlaceholder')}</option>
                {sortedCountries.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.flag} {t(`countries.${c.slug}`, { defaultValue: c.slug.replace(/_/g, ' ') })}
                  </option>
                ))}
              </select>
            </div>

            {/* About me */}
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.125rem' }}>
              <button
                onClick={handleSave}
                style={{
                  padding: '0.5rem 1.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: saved ? '#1EA876' : '#2DBF8A',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  whiteSpace: 'nowrap',
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
