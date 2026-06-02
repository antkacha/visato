export interface TripEntry {
  id: string
  entryDate: string   // "YYYY-MM-DD"
  exitDate: string    // "YYYY-MM-DD" or "ongoing"
  country: string     // country slug e.g. "france"
  notes?: string
  isPlanned?: boolean
}

export type ResidencyStatus = 'tourist' | 'eu_pr' | 'tps'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'en' | 'ru'
  residencyStatus: ResidencyStatus
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
