import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { ResetEvent } from '../../types'
import { formatDateShort } from '../../utils/dateUtils'

interface Props {
  resets: ResetEvent[]
}

export default function ResetTimeline({ resets }: Props) {
  const { t, i18n } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const visible = resets.slice(0, 5)

  if (visible.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {t('resets.none')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {t('resets.title')}
      </h3>
      <ul className="space-y-1.5">
        {visible.map((event, i) => (
          <motion.li
            key={event.date}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={
              shouldReduceMotion ? { duration: 0 } : { delay: i * 0.08, duration: 0.3 }
            }
            className="flex items-center gap-3 text-sm"
          >
            <span
              className="font-medium tabular-nums"
              style={{ color: 'var(--color-text)', minWidth: '5rem' }}
            >
              {formatDateShort(event.date, i18n.language)}
            </span>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
              +{event.daysReleased}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              → {t('trips.days_other', { count: event.totalAfter })}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
