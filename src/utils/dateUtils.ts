import { format, parseISO } from 'date-fns'
import { enUS, ru, uk, type Locale } from 'date-fns/locale'

const LOCALES: Record<string, Locale> = { en: enUS, uk, ru }

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDate(isoDate: string, lng = 'en'): string {
  try {
    return format(parseISO(isoDate), 'd MMM yyyy', { locale: LOCALES[lng] ?? enUS })
  } catch {
    return isoDate
  }
}

export function formatDateShort(isoDate: string, lng = 'en'): string {
  try {
    return format(parseISO(isoDate), 'd MMM', { locale: LOCALES[lng] ?? enUS })
  } catch {
    return isoDate
  }
}
