import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TripEntry } from '../types'
import { getAchievements, type EvaluatedAchievement } from '../utils/achievementUtils'
import { ACHIEVEMENT_COLORS } from '../constants/achievements'

interface Props {
  trips: TripEntry[]
}

function AchievementCard({ a }: { a: EvaluatedAchievement }) {
  const { t } = useTranslation()
  const colors = ACHIEVEMENT_COLORS[a.color]

  const cardBg      = a.unlocked ? colors.bg : 'var(--color-surface)'
  const emojiOpacity = a.unlocked ? 1 : 0.35

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${a.unlocked ? colors.bg : 'var(--color-border)'}`,
      borderRadius: '1rem',
      padding: '1.25rem 1rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: '0.5rem',
      transition: 'box-shadow 0.15s ease',
      boxShadow: a.unlocked ? `0 2px 12px ${colors.bg}` : 'none',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Emoji */}
      <div style={{ fontSize: '2.25rem', lineHeight: 1, opacity: emojiOpacity, marginBottom: '0.125rem' }}>
        {a.emoji}
      </div>

      {/* Name */}
      <div style={{
        fontSize: '0.8125rem', fontWeight: 700,
        color: a.unlocked ? 'var(--color-heading)' : 'var(--color-text-muted)',
        lineHeight: 1.2,
      }}>
        {t(`achievements.${a.id}.name`)}
      </div>

      {/* Description */}
      <div style={{
        fontSize: '0.6875rem',
        color: 'var(--color-text-muted)',
        lineHeight: 1.35,
        flexGrow: 1,
      }}>
        {t(`achievements.${a.id}.desc`)}
      </div>

      {/* Status row */}
      {a.unlocked ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.2rem 0.6rem',
          borderRadius: '999px',
          background: colors.accent + '22',
          color: colors.accent,
          fontSize: '0.6875rem', fontWeight: 700,
          marginTop: '0.25rem',
        }}>
          ✓ {t('achievements.unlocked')}
        </div>
      ) : (
        <div style={{ width: '100%', marginTop: '0.25rem' }}>
          <div style={{
            height: '4px', borderRadius: '999px',
            background: 'var(--color-border)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '999px',
              background: colors.accent,
              width: `${Math.round(a.progress * 100)}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{
            fontSize: '0.625rem', color: 'var(--color-text-muted)',
            marginTop: '0.25rem', fontWeight: 500,
          }}>
            {a.current} / {a.target}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AchievementsPage({ trips }: Props) {
  const { t } = useTranslation()
  const achievements = useMemo(() => getAchievements(trips), [trips])
  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const sorted = [...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked))

  return (
    <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{
          fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-heading)',
          margin: '0 0 0.25rem', letterSpacing: '-0.02em',
        }}>
          {t('achievements.title')}
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
          {t('achievements.subtitle', { count: unlockedCount })}
        </p>
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ gap: '0.875rem' }}
      >
        {sorted.map((a) => (
          <AchievementCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  )
}
