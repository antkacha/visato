import { useRef } from 'react'
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
  onExport: () => void
  onImport: (file: File) => Promise<number>
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
  onExport,
  onImport,
  onSettingsOpen,
  user,
  authLoading,
  syncing,
  onSignIn,
  onSignOut,
  tripCount,
}: Props) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme)
    onThemeChange(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const count = await onImport(file)
      alert(t('export.importSuccess', { count }))
    } catch {
      alert(t('export.importError'))
    }
    e.target.value = ''
  }

  return (
    <header
      style={{
        background: '#fff',
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
              style={{ background: 'rgba(45,191,138,0.15)', color: '#1A7A59' }}
            >
              {tripCount}
            </span>
          )}
        </div>

        {/* Right: auth + controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Auth button — most prominent action */}
          <AuthButton
            user={user}
            authLoading={authLoading}
            syncing={syncing}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
          />

          {/* Separator */}
          <div style={{ width: 1, height: '1.25rem', background: 'var(--color-border)' }} />

          {/* Language toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {(['en', 'ru'] as Language[]).map((lang) => (
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

          {/* Export */}
          <button
            onClick={onExport}
            title={t('export.export')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors"
            style={{ background: 'transparent', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            ↓
          </button>

          {/* Import */}
          <button
            onClick={handleImportClick}
            title={t('export.import')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors"
            style={{ background: 'transparent', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            ↑
          </button>

          {/* Settings */}
          <button
            onClick={onSettingsOpen}
            title={t('settings.title')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors"
            style={{ background: 'transparent', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            ⚙
          </button>

          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      </div>
    </header>
  )
}
