import { useState, useEffect, useCallback } from 'react'
import type { AppSettings, ResidencyStatus } from '../types'
import { loadSettings, saveSettings } from '../utils/storage'

type Theme = AppSettings['theme']
type Language = AppSettings['language']

export function useTheme() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const setTheme = useCallback((theme: Theme) => {
    setSettings((prev) => {
      const next = { ...prev, theme }
      saveSettings(next)
      return next
    })
  }, [])

  const setLanguage = useCallback((language: Language) => {
    setSettings((prev) => {
      const next = { ...prev, language }
      saveSettings(next)
      return next
    })
  }, [])

  const setResidencyStatus = useCallback((residencyStatus: ResidencyStatus) => {
    setSettings((prev) => {
      const next = { ...prev, residencyStatus }
      saveSettings(next)
      return next
    })
  }, [])

  return {
    theme: settings.theme,
    language: settings.language,
    residencyStatus: settings.residencyStatus,
    setTheme,
    setLanguage,
    setResidencyStatus,
  }
}
