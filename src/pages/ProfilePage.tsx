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

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <line x1="5.5" y1="1" x2="5.5" y2="10" />
      <line x1="1" y1="5.5" x2="10" y2="5.5" />
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

  useEffect(() => {
    const stored = loadProfile()
    const name = (user?.user_metadata?.full_name ?? user?.email ?? '') as string
    setDisplayName(stored.displayName || name)
    setHomeCountry(stored.homeCountry || '')
    setBio(stored.bio || '')
    if (stored.photoUrl) setLocalAvatar(stored.photoUrl)
  }, [user])

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
    e.target.value = ''
  }

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

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(
        LOCALE_MAP[i18n.language] ?? 'en-US',
        { month: 'long', year: 'numeric' },
      )
    : null

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

  const googleAvatar  = user.user_metadata?.avatar_url as string | undefined
  const displayAvatar = localAvatar || googleAvatar
  const fullName      = (user.user_metadata?.full_name ?? user.email ?? '') as string
  const email         = user.email ?? ''

  // White input, light border — clean on white page
  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '0.5625rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    marginBottom: '0.375rem',
  }

  const statCards = [
    { label: t('profile.stats.countries'), value: String(uniqueCountries), isString: false },
    { label: t('profile.stats.trips'),     value: String(trips.length),    isString: false },
    { label: t('profile.stats.days'),      value: String(totalDays),       isString: false },
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
      <div style={{ maxWidth: '44rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* ── User header — no card, bare layout ────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

          {/* Avatar + "+" overlay */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {displayAvatar ? (
              <img
                src={displayAvatar} alt={fullName}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: '#2DBF8A', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', fontWeight: 800,
              }}>
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              title={t('profile.changePhoto')}
              style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 24, height: 24, borderRadius: '50%',
                background: '#2DBF8A', border: '2px solid var(--color-section)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PlusIcon />
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
              marginBottom: '0.2rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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

        {/* ── Stats grid — all 4 same height, vertically centered ────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((s, i) => (
            <div key={i} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.875rem',
              padding: '1rem 0.75rem',
              minHeight: 96,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '0.375rem', textAlign: 'center',
            }}>
              <div style={{
                fontSize: s.isString ? '1rem' : '1.75rem',
                fontWeight: 800,
                color: '#2DBF8A',
                lineHeight: 1.2,
                letterSpacing: s.isString ? 0 : '-0.02em',
                wordBreak: 'break-word',
              }}>
                {s.value}
              </div>
              <div style={{
                fontSize: '0.75rem', color: 'var(--color-text-muted)',
                fontWeight: 500, lineHeight: 1.3,
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Personal info form ─────────────────────────────────────────── */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          {/* Section title with mint tab underline */}
          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{
              display: 'inline-block',
              fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-heading)',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #2DBF8A',
            }}>
              {t('profile.personal.title')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

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

            {/* Save — right-aligned, natural width */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
