import { useTranslation } from 'react-i18next'
import type { TrackedZone } from '../../types'
import type { ZoneStatus } from '../../utils/zones'
import { ZONE_CONFIGS } from '../../utils/zones'

interface Props {
  status: ZoneStatus
}

const ZONE_FLAG: Record<TrackedZone, string> = {
  uk:       '🇬🇧',
  usa:      '🇺🇸',
  turkey:   '🇹🇷',
  uae:      '🇦🇪',
  thailand: '🇹🇭',
  georgia:  '🇬🇪',
}

function ruleLabel(zone: TrackedZone, t: (k: string, opts?: object) => string): string {
  const { limitDays, windowDays, windowType } = ZONE_CONFIGS[zone]
  if (windowType === 'per_entry') return t('zones.rulePerEntry', { limit: limitDays })
  return t('zones.ruleRolling', { limit: limitDays, window: windowDays })
}

function barColor(remaining: number, isOverLimit: boolean): string {
  if (isOverLimit || remaining === 0) return 'var(--color-danger)'
  if (remaining < 10) return 'var(--color-danger)'
  if (remaining < Math.floor(remaining * 0.33 + 10)) return 'var(--color-warning)'
  return 'var(--color-success)'
}

export default function ZoneCard({ status }: Props) {
  const { t } = useTranslation()
  const { zone, daysUsed, daysRemaining, limitDays, windowDays, isOverLimit, windowType } = status
  const fraction = Math.min(daysUsed / limitDays, 1)
  const color = barColor(daysRemaining, isOverLimit)

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{ZONE_FLAG[zone]}</span>
          <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
            {t(`zones.${zone}`)}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            · {ruleLabel(zone, t)}
          </span>
        </div>
        {isOverLimit && (
          <span className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
            {t('dashboard.overLimit')}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '8px',
          borderRadius: '4px',
          background: 'var(--color-border)',
          overflow: 'hidden',
          marginBottom: '0.5rem',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${fraction * 100}%`,
            borderRadius: '4px',
            background: color,
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-baseline justify-between">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <strong style={{ color, fontSize: '1.25rem', fontWeight: 700 }}>{daysUsed}</strong>
          {' / '}{limitDays}{' '}{t('trips.days_other', { count: limitDays })}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {windowType === 'per_entry'
            ? t('zones.currentEntry')
            : t('zones.inLastDays', { days: windowDays })}
        </span>
      </div>
    </div>
  )
}
