import { useTranslation } from 'react-i18next'
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
  onSettingsOpen: () => void
  user: User | null
  authLoading: boolean
  syncing: boolean
  onSignIn: () => void
  onSignOut: () => void
  tripCount: number
}

const THEME_ICONS: Record<Theme, string> = {
  light: '☀️',
  dark: '🌙',
}

const THEME_CYCLE: Theme[] = ['light', 'dark']

export default function Header({
  theme,
  language,
  onThemeChange,
  onLanguageChange,
  onSettingsOpen,
  user,
  authLoading,
  syncing,
  onSignIn,
  onSignOut,
  tripCount,
}: Props) {
  const { t } = useTranslation()

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme)
    onThemeChange(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
  }

  return (
    <header
      style={{
        background: 'var(--color-section)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Left: logo + trip count */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🌍</span>
          <span
            className="font-bold text-base hidden sm:inline"
            style={{ color: '#2DBF8A', letterSpacing: '-0.01em' }}
          >
            Visato
          </span>
          {tripCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(45,191,138,0.15)', color: '#2DBF8A' }}
            >
              {tripCount}
            </span>
          )}
        </div>

        {/* Right: auth + controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
          {/* Auth button — most prominent action */}
          <AuthButton
            user={user}
            authLoading={authLoading}
            syncing={syncing}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
          />

          {/* Separator — desktop only */}
          <div className="hidden sm:block" style={{ width: 1, height: '1.25rem', background: 'var(--color-border)' }} />

          {/* Language toggle — always visible */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {(['en', 'uk', 'ru'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: language === lang ? 'var(--color-accent)' : 'transparent',
                  color: language === lang ? '#fff' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            title={t(`settings.theme${theme.charAt(0).toUpperCase() + theme.slice(1)}` as never)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-base"
            style={{ background: 'transparent', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text)' }}
          >
            {THEME_ICONS[theme]}
          </button>

          {/* Settings — desktop only (language+theme cover mobile needs) */}
          <button
            onClick={onSettingsOpen}
            title={t('settings.title')}
            className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-base transition-colors"
            style={{ background: 'transparent', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            ⚙
          </button>

        </div>
      </div>
    </header>
  )
}
