import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../types'
import { loadSettings, saveSettings } from '../utils/storage'

type Theme = AppSettings['theme']
type Language = AppSettings['language']

const SYNC_EVENT = 'visato:settings-changed'

export function useTheme() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  // Sync all useTheme instances when any one of them writes settings
  useEffect(() => {
    const handler = () => setSettings(loadSettings())
    window.addEventListener(SYNC_EVENT, handler)
    return () => window.removeEventListener(SYNC_EVENT, handler)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const setTheme = useCallback((theme: Theme) => {
    setSettings((prev) => {
      const next = { ...prev, theme }
      saveSettings(next)
      window.dispatchEvent(new CustomEvent(SYNC_EVENT))
      return next
    })
  }, [])

  const setLanguage = useCallback((language: Language) => {
    setSettings((prev) => {
      const next = { ...prev, language }
      saveSettings(next)
      window.dispatchEvent(new CustomEvent(SYNC_EVENT))
      return next
    })
  }, [])

  return {
    theme: settings.theme,
    language: settings.language,
    setTheme,
    setLanguage,
  }
}
