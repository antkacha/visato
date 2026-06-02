import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

interface Props {
  daysUsed: number
  daysRemaining: number
  isOverLimit: boolean
}

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function accentColor(remaining: number, overLimit: boolean): string {
  if (overLimit || remaining === 0) return 'var(--color-danger)'
  if (remaining < 10) return 'var(--color-danger)'
  if (remaining < 30) return 'var(--color-warning)'
  return 'var(--color-success)'
}

export default function DaysGauge({ daysUsed, daysRemaining, isOverLimit }: Props) {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const fraction = Math.min(daysUsed / 90, 1)
  const dashOffset = CIRCUMFERENCE * (1 - fraction)
  const color = accentColor(daysRemaining, isOverLimit)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Track */}
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="10"
          />
          {/* Progress arc */}
          <motion.circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 1, ease: 'easeOut' }
            }
            style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {daysRemaining}
          </span>
          <span
            className="text-xs font-medium mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            / 90
          </span>
        </div>
      </div>

      <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {isOverLimit ? (
          <span style={{ color: 'var(--color-danger)' }}>{t('dashboard.overLimit')}</span>
        ) : (
          t('dashboard.daysRemaining')
        )}
      </p>
    </div>
  )
}
