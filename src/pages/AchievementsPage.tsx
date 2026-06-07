import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
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

  // Use accent color at low opacity so tint adapts to both light and dark backgrounds
  const unlockedBg     = `${colors.accent}22`
  const unlockedBorder = `${colors.accent}55`
  const emojiOpacity   = a.unlocked ? 1 : 0.3

  return (
    <div style={{
      background: a.unlocked ? unlockedBg : 'var(--color-surface)',
      border: `1px solid ${a.unlocked ? unlockedBorder : 'var(--color-border)'}`,
      borderRadius: '1rem',
      padding: '1.25rem 1rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: '0.5rem',
      transition: 'box-shadow 0.15s ease',
      boxShadow: a.unlocked ? `0 2px 16px ${colors.accent}25` : '0 1px 4px rgba(0,0,0,0.05)',
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
          background: `${colors.accent}22`,
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
  const navigate = useNavigate()
  const achievements = useMemo(() => getAchievements(trips), [trips])
  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const sorted = [...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked))

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{ maxWidth: '52rem', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}
    >
      {/* Back button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/profile')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            padding: '0.375rem 0.875rem',
            color: 'var(--color-text-muted)',
            fontSize: '0.8125rem', fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2DBF8A'
            e.currentTarget.style.color = '#2DBF8A'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)'
            e.currentTarget.style.color = 'var(--color-text-muted)'
          }}
        >
          ← {t('common.back')}
        </button>
      </div>

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
    </motion.div>
  )
}
