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
  background: 'transparent', border: 'none',
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

        {/* CENTER: Nav links */}
        <style>{`
          .nav-link        { color: #6B7280; border-bottom: 2px solid transparent; transition: color 0.15s ease; }
          .nav-link:hover  { color: #2DBF8A; }
          .nav-link-active { color: #2DBF8A; border-bottom: 2px solid #2DBF8A; }
        `}</style>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
          {navLinks.map(({ label, to }) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                className={active ? 'nav-link-active' : 'nav-link'}
                style={{
                  textDecoration: 'none',
                  padding: '0.375rem 0.75rem 4px',
                  fontSize: '0.875rem',
                  fontWeight: active ? 700 : 500,
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
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: '0', flexShrink: 0 }}>
            {(['en', 'uk', 'ru'] as Language[]).map((lang, i) => (
              <div key={lang} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  <span style={{
                    width: 1, height: '0.875rem',
                    background: 'var(--color-border)',
                    display: 'inline-block', flexShrink: 0,
                  }} />
                )}
                <button
                  onClick={() => onLanguageChange(lang)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'transparent', border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: language === lang ? 700 : 400,
                    color: language === lang ? '#2DBF8A' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {lang.toUpperCase()}
                </button>
              </div>
            ))}
          </div>

          {/* Theme toggle */}
          <button onClick={cycleTheme} style={iconBtn} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {THEME_ICONS[theme]}
          </button>

          {/* Auth (always visible — sign-out lives in avatar dropdown) */}
          <AuthButton
            user={user}
            authLoading={authLoading}
            syncing={syncing}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  )
}
