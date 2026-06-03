export interface TripEntry {
  id: string
  entryDate: string   // "YYYY-MM-DD"
  exitDate: string    // "YYYY-MM-DD" or "ongoing"
  country: string     // country slug e.g. "france"
  notes?: string
  isPlanned?: boolean
}

export type Zone = 'schengen' | 'uk' | 'usa' | 'turkey' | 'uae' | 'thailand' | 'georgia' | 'other'
export type TrackedZone = Exclude<Zone, 'schengen' | 'other'>

export interface AppSettings {
  theme: 'light' | 'dark'
  language: 'en' | 'uk' | 'ru'
}

export interface SchengenStatus {
  daysUsed: number
  daysRemaining: number
  windowStart: string
  windowEnd: string
  maxConsecutiveDays: number
  resets: ResetEvent[]
  isOverLimit: boolean
}

export interface ResetEvent {
  date: string
  daysReleased: number
  totalAfter: number
}

export interface TripValidationResult {
  isValid: boolean
  firstViolationDate?: string
  daysOverLimit?: number
  maxSafeDays?: number
}
