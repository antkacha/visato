import { useTranslation } from 'react-i18next'
import type { TripEntry } from '../../types'
import { parseISO, addDays, differenceInDays, format } from 'date-fns'
import { COUNTRY_FLAGS } from '../../constants/countries'
import { getTripStatus } from '../../utils/dateUtils'

interface Props {
  trips: TripEntry[]
}

const COUNTRY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
]

const colorCache: Record<string, string> = {}
let colorIdx = 0

function countryColor(slug: string): string {
  if (!colorCache[slug]) {
    colorCache[slug] = COUNTRY_COLORS[colorIdx % COUNTRY_COLORS.length]
    colorIdx++
  }
  return colorCache[slug]
}

const TODAY_ISO = format(new Date(), 'yyyy-MM-dd')

export default function Timeline({ trips }: Props) {
  const { t } = useTranslation()

  const rangeStart = addDays(parseISO(TODAY_ISO), -180)
  const rangeEnd = addDays(parseISO(TODAY_ISO), 60)
  const totalDays = differenceInDays(rangeEnd, rangeStart) // = 240

  if (trips.length === 0) return null

  const toPercent = (iso: string) => {
    const d = parseISO(iso)
    const offset = differenceInDays(d, rangeStart)
    return Math.max(0, Math.min(100, (offset / totalDays) * 100))
  }

  const todayPct = toPercent(TODAY_ISO)
  const windowStartPct = toPercent(format(addDays(parseISO(TODAY_ISO), -179), 'yyyy-MM-dd'))

  const visibleTrips = trips.filter((trip) => {
    const exit = trip.exitDate === 'ongoing' ? TODAY_ISO : trip.exitDate
    return exit >= format(rangeStart, 'yyyy-MM-dd') && trip.entryDate <= format(rangeEnd, 'yyyy-MM-dd')
  })

  // Month labels
  const months: { label: string; pct: number }[] = []
  for (let i = 0; i <= totalDays; i += 30) {
    const d = addDays(rangeStart, i)
    months.push({
      label: format(d, 'MMM', { locale: undefined }),
      pct: (i / totalDays) * 100,
    })
  }

  return (
    <section className="glass-card p-5 overflow-hidden">
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
        {t('timeline.title')}
      </h2>

      <div className="overflow-x-auto">
        <div style={{ minWidth: '500px' }}>
          {/* Timeline bar */}
          <div className="relative" style={{ height: '64px' }}>
            {/* 180-day window background */}
            <div
              style={{
                position: 'absolute',
                left: `${windowStartPct}%`,
                width: `${todayPct - windowStartPct}%`,
                top: 0,
                bottom: 0,
                background: 'rgba(59,130,246,0.08)',
                borderRadius: '4px',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            />

            {/* Trip bars */}
            {visibleTrips.map((trip, i) => {
              const exit = trip.exitDate === 'ongoing' ? TODAY_ISO : trip.exitDate
              const left = toPercent(trip.entryDate)
              const right = toPercent(exit)
              const color = countryColor(trip.country)
              const row = i % 3

              return (
                <div
                  key={trip.id}
                  title={`${COUNTRY_FLAGS[trip.country] ?? ''} ${t(`countries.${trip.country}`, { defaultValue: trip.country })}\n${trip.entryDate} – ${trip.exitDate}`}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${Math.max(right - left, 0.5)}%`,
                    top: `${8 + row * 18}px`,
                    height: '14px',
                    background: getTripStatus(trip, TODAY_ISO) === 'planned' ? 'transparent' : color,
                    border: `2px solid ${color}`,
                    borderRadius: '4px',
                    opacity: getTripStatus(trip, TODAY_ISO) === 'planned' ? 0.6 : 0.85,
                    cursor: 'default',
                  }}
                />
              )
            })}

            {/* Today marker */}
            <div
              style={{
                position: 'absolute',
                left: `${todayPct}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                background: 'var(--color-accent)',
                borderRadius: '1px',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${todayPct}%`,
                top: '-18px',
                transform: 'translateX(-50%)',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--color-accent)',
                whiteSpace: 'nowrap',
              }}
            >
              {t('timeline.today')}
            </div>
          </div>

          {/* Month labels */}
          <div className="relative mt-2" style={{ height: '16px' }}>
            {months.map(({ label, pct }) => (
              <span
                key={`${label}-${pct}`}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  fontSize: '10px',
                  color: 'var(--color-text-muted)',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Country legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {[...new Set(trips.map((t) => t.country))].map((slug) => (
          <div key={slug} className="flex items-center gap-1.5">
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: countryColor(slug),
              }}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {COUNTRY_FLAGS[slug]} {t(`countries.${slug}`, { defaultValue: slug })}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
