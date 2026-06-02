import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ru from './locales/ru.json'
import { loadSettings } from '../utils/storage'

const settings = loadSettings()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: settings.language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  pluralSeparator: '_',
})

export default i18n
