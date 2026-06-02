import { useState, useEffect, useCallback } from 'react'
import type { AppSettings, ResidencyStatus } from '../types'
import { loadSettings, saveSettings } from '../utils/storage'

type Theme = AppSettings['theme']
type Language = AppSettings['language']

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved)
}

export function useTheme() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    applyTheme(resolveTheme(settings.theme))
  }, [settings.theme])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(resolveTheme('system'))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
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
