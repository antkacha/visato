import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import type { AppSettings } from '../../types'
import AuthButton from '../AuthButton/AuthButton'

type Theme = AppSettings['theme']
type Language = AppSettings['language']

interface Props {
  theme: Theme
  language: Language
  onThemeChange: (t: Theme) => void
  onLanguageChange: (l: Language) => void
  user: User | null
  authLoading: boolean
  syncing: boolean
  onSignIn: () => void
  onSignOut: () => void
}

const THEME_ICONS: Record<Theme, string> = { light: '☀️', dark: '🌙' }
const THEME_CYCLE: Theme[] = ['light', 'dark']

const iconBtn: React.CSSProperties = {
  width: '2rem', height: '2rem', borderRadius: '0.5rem',
  background: 'transparent', border: '1px solid var(--color-border)',
  cursor: 'pointer', fontSize: '1rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--color-text)', flexShrink: 0,
}

export default function Header({
  theme, language, onThemeChange, onLanguageChange,
  user, authLoading, syncing, onSignIn, onSignOut,
}: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme)
    onThemeChange(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
  }

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname === to

  const navLinks = [
    { label: t('nav.home'), to: '/' },
    { label: t('nav.map'), to: '/map' },
  ]

  return (
    <header style={{
      background: 'var(--color-section)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      {/* ── Main bar ────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: '80rem', margin: '0 auto', padding: '0 1.25rem',
        height: '56px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '1rem',
      }}>

        {/* LEFT: Logo */}
        <Link
          to="/"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🌍</span>
          <span style={{ color: '#2DBF8A', fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            Visato
          </span>
        </Link>

        {/* CENTER: Nav links — desktop only */}
        <nav className="hidden md:flex" style={{ alignItems: 'center', gap: '0.125rem' }}>
          {navLinks.map(({ label, to }) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                style={{
                  textDecoration: 'none',
                  padding: '0.375rem 0.875rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#2DBF8A' : 'var(--color-text-muted)',
                  borderBottom: active ? '2px solid #2DBF8A' : '2px solid transparent',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* RIGHT: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>

          {/* Language switcher — desktop only */}
          <div
            className="hidden md:flex"
            style={{
              borderRadius: '0.5rem', overflow: 'hidden',
              border: '1px solid var(--color-border)', flexShrink: 0,
            }}
          >
            {(['en', 'uk', 'ru'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                style={{
                  padding: '0.25rem 0.625rem',
                  background: language === lang ? 'var(--color-accent)' : 'transparent',
                  color: language === lang ? '#fff' : 'var(--color-text-muted)',
                  border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Theme toggle — always visible */}
          <button onClick={cycleTheme} style={iconBtn} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {THEME_ICONS[theme]}
          </button>

          {/* Auth — desktop only */}
          <div className="hidden md:flex" style={{ alignItems: 'center' }}>
            <AuthButton
              user={user}
              authLoading={authLoading}
              syncing={syncing}
              onSignIn={onSignIn}
              onSignOut={onSignOut}
            />
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="flex md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            style={iconBtn}
            aria-label="Menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {menuOpen && (
        <div style={{
          background: 'var(--color-section)',
          borderTop: '1px solid var(--color-border)',
          padding: '0.75rem 1.25rem 1.25rem',
        }}>
          {/* Nav links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', marginBottom: '0.75rem' }}>
            {navLinks.map(({ label, to }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    textDecoration: 'none',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.9375rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#2DBF8A' : 'var(--color-text)',
                    background: active ? 'rgba(45,191,138,0.08)' : 'transparent',
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--color-border)', margin: '0.75rem 0' }} />

          {/* Language switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {(['en', 'uk', 'ru'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => { onLanguageChange(lang); setMenuOpen(false) }}
                style={{
                  flex: 1, padding: '0.5rem',
                  background: language === lang ? 'var(--color-accent)' : 'transparent',
                  color: language === lang ? '#fff' : 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Auth */}
          <AuthButton
            user={user}
            authLoading={authLoading}
            syncing={syncing}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
          />
        </div>
      )}
    </header>
  )
}
