import { useTranslation } from 'react-i18next'
import type { SchengenStatus, TripEntry, TrackedZone } from '../../types'
import DaysGauge from './DaysGauge'
import ResetTimeline from './ResetTimeline'
import ZoneCard from './ZoneCard'
import { formatDate } from '../../utils/dateUtils'
import { differenceInDays, parseISO } from 'date-fns'
import { today } from '../../utils/dateUtils'
import { COUNTRY_FLAGS, COUNTRY_ZONE } from '../../constants/countries'
import { ZONE_CONFIGS, computeZoneStatus } from '../../utils/zones'

interface Props {
  status: SchengenStatus
  trips: TripEntry[]
}

function tripDuration(trip: TripEntry): number {
  const exit = trip.exitDate === 'ongoing' ? today() : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

export default function Dashboard({ status, trips }: Props) {
  const { t, i18n } = useTranslation()

  const violationTrips = trips.filter(
    (trip) => !trip.isPlanned && tripDuration(trip) > 90 && COUNTRY_ZONE[trip.country] === 'schengen'
  )

  // Determine which tracked non-Schengen zones have trips
  const trackedZones = (Object.keys(ZONE_CONFIGS) as TrackedZone[]).filter((zone) =>
    trips.some((t) => COUNTRY_ZONE[t.country] === zone)
  )

  return (
    <>
      {/* ── Schengen card ─────────────────────────────────────────────── */}
      <div className="glass-card p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Main gauge row */}
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          {/* Gauge */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <DaysGauge
              daysUsed={status.daysUsed}
              daysRemaining={status.daysRemaining}
              isOverLimit={status.isOverLimit}
            />
            <div className="text-center">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t('dashboard.daysUsed')}: <strong style={{ color: 'var(--color-text)' }}>{status.daysUsed}</strong>
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {t('dashboard.window', {
                  start: formatDate(status.windowStart, i18n.language),
                  end: formatDate(status.windowEnd, i18n.language),
                })}
              </p>
            </div>
          </div>

          {/* Dividers */}
          <div className="hidden sm:block self-stretch" style={{ width: 1, background: 'var(--color-border)' }} />
          <div className="block sm:hidden w-full" style={{ height: 1, background: 'var(--color-border)' }} />

          {/* Reset events + max stay */}
          <div className="flex-1 space-y-4 w-full">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {t('dashboard.maxStay')}
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                {status.maxConsecutiveDays}{' '}
                <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>
                  {t('trips.days_other', { count: status.maxConsecutiveDays })}
                </span>
              </p>
            </div>
            <ResetTimeline resets={status.resets} />
          </div>
        </div>

        {/* Past Schengen violations */}
        {violationTrips.length > 0 && (
          <div>
            <div style={{ height: 1, background: 'var(--color-border)', margin: '0 0 1rem' }} />
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-warning)' }}
            >
              {t('dashboard.violations')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {violationTrips.map((trip) => {
                const dur = tripDuration(trip)
                const flag = COUNTRY_FLAGS[trip.country] ?? '🏳️'
                const name = t(`countries.${trip.country}`, { defaultValue: trip.country })
                return (
                  <div
                    key={trip.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.25)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span>{flag}</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{name}</span>
                    <span style={{ color: 'var(--color-text-muted)', flex: 1 }}>
                      {formatDate(trip.entryDate, i18n.language)} –{' '}
                      {trip.exitDate === 'ongoing'
                        ? t('trips.ongoing')
                        : formatDate(trip.exitDate, i18n.language)}
                    </span>
                    <span style={{ color: 'var(--color-warning)', fontWeight: 600, flexShrink: 0 }}>
                      {dur}d
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Per-zone tracker cards ─────────────────────────────────────── */}
      {trackedZones.map((zone) => (
        <ZoneCard
          key={zone}
          status={computeZoneStatus(zone, trips.filter((t) => COUNTRY_ZONE[t.country] === zone))}
        />
      ))}
    </>
  )
}
