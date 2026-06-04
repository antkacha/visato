import { useState, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { differenceInDays, parseISO } from 'date-fns'
import type { User } from '@supabase/supabase-js'
import type { TripEntry } from '../types'
import { ALL_COUNTRIES, COUNTRY_FLAGS } from '../constants/countries'
import { loadProfile, saveProfile } from '../utils/storage'
import { supabase } from '../lib/supabase'
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

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [homeCountry, setHomeCountry]  = useState('')
  const [bio, setBio]                  = useState('')
  const [localAvatar, setLocalAvatar]  = useState<string | null>(null)

  // UI state
  const [savedName, setSavedName] = useState('') // name shown in top section, only updates on save
  const [showToast, setShowToast] = useState(false)

  // ── Load profile on mount: Supabase first, localStorage fallback ─────────
  useEffect(() => {
    if (!user) return
    const authName = (user.user_metadata?.full_name ?? user.email ?? '') as string

    const init = async () => {
      // Try Supabase profiles table first
      if (supabase) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('display_name, home_country, bio')
            .eq('id', user.id)
            .single()
          if (data) {
            const dn = (data.display_name as string | null) || authName
            setDisplayName(dn)
            setSavedName(dn)
            setHomeCountry((data.home_country as string | null) || '')
            setBio((data.bio as string | null) || '')
            // Photo stays in localStorage (binary not stored in Supabase here)
            const stored = loadProfile()
            if (stored.photoUrl) setLocalAvatar(stored.photoUrl)
            return
          }
        } catch {
          // profiles table doesn't exist yet — fall through to localStorage
        }
      }

      // localStorage fallback
      const stored = loadProfile()
      const dn = stored.displayName || authName
      setDisplayName(dn)
      setSavedName(dn)
      setHomeCountry(stored.homeCountry || '')
      setBio(stored.bio || '')
      if (stored.photoUrl) setLocalAvatar(stored.photoUrl)
    }

    init()
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
    e.target.value = ''
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    // 1. Persist immediately to localStorage
    saveProfile({ displayName, homeCountry, bio, photoUrl: localAvatar ?? undefined })

    // 2. Update top-section name immediately
    setSavedName(displayName)

    // 3. Show toast
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2500)

    if (supabase && user) {
      const uid = user.id
      const dn  = displayName
      const hc  = homeCountry

      // 4. Update auth metadata → USER_UPDATED fires → header re-renders
      void supabase.auth.updateUser({ data: { full_name: dn } })

      // 5. Upsert to profiles table (no-op if table doesn't exist yet)
      void (async () => {
        try {
          await supabase.from('profiles').upsert({
            id: uid, display_name: dn, home_country: hc, bio,
            updated_at: new Date().toISOString(),
          })
        } catch { /* profiles table absent — localStorage is the fallback */ }
      })()
    }
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

  const googleAvatar  = user.user_metadata?.avatar_url as string | undefined
  const displayAvatar = localAvatar || googleAvatar
  // Top-section name: savedName (what was last saved) or auth name as fallback
  const authName = (user.user_metadata?.full_name ?? user.email ?? '') as string
  const topName  = savedName || authName
  const email    = user.email ?? ''

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
                src={displayAvatar} alt={topName}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: '#2DBF8A', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', fontWeight: 800,
              }}>
                {topName.charAt(0).toUpperCase()}
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

          {/* Name / email / member since — shows savedName, updates on save */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '1.375rem', fontWeight: 800, color: 'var(--color-heading)',
              lineHeight: 1.2, marginBottom: '0.25rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {topName}
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

        {/* ── Stats grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((s, i) => (
            <div key={i} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.875rem',
              padding: '1rem 0.75rem',
              minHeight: 96,
              height: '100%',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '0.375rem', textAlign: 'center',
              boxSizing: 'border-box',
            }}>
              <div style={{
                fontSize: s.isString ? '1rem' : '1.75rem',
                fontWeight: 800, color: '#2DBF8A',
                lineHeight: 1.2, letterSpacing: s.isString ? 0 : '-0.02em',
                wordBreak: 'break-word',
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
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
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

            <div>
              <label style={fieldLabel}>{t('profile.personal.displayName')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputBase}
              />
            </div>

            <div>
              <label style={fieldLabel}>{t('profile.personal.homeCountry')}</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={homeCountry}
                  onChange={(e) => setHomeCountry(e.target.value)}
                  style={{
                    ...inputBase,
                    paddingRight: '2.25rem',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                >
                  <option value="">{t('profile.personal.homeCountryPlaceholder')}</option>
                  {sortedCountries.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.flag} {t(`countries.${c.slug}`, { defaultValue: c.slug.replace(/_/g, ' ') })}
                    </option>
                  ))}
                </select>
                {/* Custom chevron — hidden from pointer events so clicks pass through */}
                <span style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none', color: 'var(--color-text-muted)',
                  display: 'flex', alignItems: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4.5L6 8.5L10 4.5" />
                  </svg>
                </span>
              </div>
            </div>

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

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSave}
                style={{
                  padding: '0.5rem 1.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#2DBF8A',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('profile.personal.save')}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── Success toast ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
              background: '#2DBF8A', color: '#fff',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem', fontWeight: 600,
              boxShadow: '0 4px 20px rgba(45,191,138,0.45)',
              zIndex: 500, whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, sans-serif',
              pointerEvents: 'none',
            }}
          >
            ✓ {t('profile.personal.saved')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
