export const ACHIEVEMENT_COLORS: Record<string, { bg: string; accent: string }> = {
  green:  { bg: '#E8F8F2', accent: '#2DBF8A' },
  amber:  { bg: '#FEF3C7', accent: '#D97706' },
  blue:   { bg: '#EFF6FF', accent: '#3B82F6' },
  purple: { bg: '#F5F3FF', accent: '#8B5CF6' },
  coral:  { bg: '#FEF2F2', accent: '#EF4444' },
  teal:   { bg: '#E0FDF4', accent: '#0D9488' },
  pink:   { bg: '#FDF2F8', accent: '#EC4899' },
}

export interface Achievement {
  id: string
  emoji: string
  color: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-trip',       emoji: '✈️',  color: 'green'  },
  { id: 'mapper',           emoji: '🗺️',  color: 'blue'   },
  { id: 'regular',          emoji: '📅',  color: 'amber'  },
  { id: 'beginner',         emoji: '🌱',  color: 'green'  },
  { id: 'explorer',         emoji: '🌍',  color: 'amber'  },
  { id: 'adventurer',       emoji: '🌎',  color: 'blue'   },
  { id: 'globetrotter',     emoji: '🌐',  color: 'purple' },
  { id: 'one-month',        emoji: '📆',  color: 'teal'   },
  { id: 'long-haul',        emoji: '🏖️',  color: 'amber'  },
  { id: 'nomad',            emoji: '🌴',  color: 'coral'  },
  { id: 'alps-lover',       emoji: '🏔️',  color: 'purple' },
  { id: 'mediterranean',    emoji: '🌊',  color: 'blue'   },
  { id: 'nordic',           emoji: '🧊',  color: 'teal'   },
  { id: 'eastern-europe',   emoji: '🏰',  color: 'amber'  },
  { id: 'summer-escape',    emoji: '☀️',  color: 'coral'  },
  { id: 'winter-traveller', emoji: '❄️',  color: 'blue'   },
  { id: 'loyal',            emoji: '🔁',  color: 'green'  },
]
