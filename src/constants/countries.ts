export interface Country {
  slug: string
  flag: string
}

export const SCHENGEN_COUNTRIES: Country[] = [
  { slug: 'austria', flag: '🇦🇹' },
  { slug: 'belgium', flag: '🇧🇪' },
  { slug: 'bulgaria', flag: '🇧🇬' },
  { slug: 'croatia', flag: '🇭🇷' },
  { slug: 'czech_republic', flag: '🇨🇿' },
  { slug: 'denmark', flag: '🇩🇰' },
  { slug: 'estonia', flag: '🇪🇪' },
  { slug: 'finland', flag: '🇫🇮' },
  { slug: 'france', flag: '🇫🇷' },
  { slug: 'germany', flag: '🇩🇪' },
  { slug: 'greece', flag: '🇬🇷' },
  { slug: 'hungary', flag: '🇭🇺' },
  { slug: 'iceland', flag: '🇮🇸' },
  { slug: 'italy', flag: '🇮🇹' },
  { slug: 'latvia', flag: '🇱🇻' },
  { slug: 'liechtenstein', flag: '🇱🇮' },
  { slug: 'lithuania', flag: '🇱🇹' },
  { slug: 'luxembourg', flag: '🇱🇺' },
  { slug: 'malta', flag: '🇲🇹' },
  { slug: 'netherlands', flag: '🇳🇱' },
  { slug: 'norway', flag: '🇳🇴' },
  { slug: 'poland', flag: '🇵🇱' },
  { slug: 'portugal', flag: '🇵🇹' },
  { slug: 'romania', flag: '🇷🇴' },
  { slug: 'slovakia', flag: '🇸🇰' },
  { slug: 'slovenia', flag: '🇸🇮' },
  { slug: 'spain', flag: '🇪🇸' },
  { slug: 'sweden', flag: '🇸🇪' },
  { slug: 'switzerland', flag: '🇨🇭' },
]

export const COUNTRY_FLAGS: Record<string, string> = Object.fromEntries(
  SCHENGEN_COUNTRIES.map((c) => [c.slug, c.flag])
)
