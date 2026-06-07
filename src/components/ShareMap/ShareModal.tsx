import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import html2canvas from 'html2canvas'
import type { User } from '@supabase/supabase-js'
import type { TripEntry } from '../../types'
import { geoFeatureSlug } from '../../constants/countryIsoMap'
import { COUNTRY_FLAGS } from '../../constants/countries'
import { differenceInDays, parseISO } from 'date-fns'
import { today } from '../../utils/dateUtils'

interface Props {
  isOpen: boolean
  onClose: () => void
  trips: TripEntry[]
  topoData: unknown
  user: User | null
}

function tripDays(trip: TripEntry): number {
  const exit = trip.exitDate === 'ongoing' ? today() : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

type FormatKey = '9:16' | '16:9'
type CardLang  = 'en' | 'uk' | 'ru'
type Stage     = 'settings' | 'generating' | 'done' | 'error'

const FORMATS: Record<FormatKey, { w: number; h: number; label: string }> = {
  '9:16': { w: 1080, h: 1350, label: 'Vertical'   },
  '16:9': { w: 1200, h: 675,  label: 'Horizontal' },
}

const FORMAT_KEYS: FormatKey[] = ['9:16', '16:9']
const CARD_LANGS: CardLang[]   = ['en', 'uk', 'ru']

// Two-word labels so they wrap cleanly inside horizontal mini-cards
const CARD_STR: Record<CardLang, {
  countriesLine1: string; countriesLine2: string
  daysLine1: string;      daysLine2: string
  tripsLine1: string;     tripsLine2: string
}> = {
  en: {
    countriesLine1: 'COUNTRIES', countriesLine2: 'VISITED',
    daysLine1: 'DAYS',           daysLine2: 'ABROAD',
    tripsLine1: 'TRIPS',         tripsLine2: 'TAKEN',
  },
  uk: {
    countriesLine1: 'ВІДВІДАНО', countriesLine2: 'КРАЇН',
    daysLine1: 'ДНІВ',           daysLine2: 'ЗА КОРДОНОМ',
    tripsLine1: 'ПОЇЗДОК',       tripsLine2: '',
  },
  ru: {
    countriesLine1: 'ПОСЕЩЕНО',  countriesLine2: 'СТРАН',
    daysLine1: 'ДНЕЙ',           daysLine2: 'ЗА РУБЕЖОМ',
    tripsLine1: 'ПОЕЗДОК',       tripsLine2: '',
  },
}

// ── Shared flat map ──────────────────────────────────────────────────────────
function ShareMap({
  topoData, visitedSlugs, width, height, scale,
}: {
  topoData: unknown; visitedSlugs: Set<string>
  width: number; height: number; scale: number
}) {
  return (
    <ComposableMap
      width={width} height={height}
      projectionConfig={{ scale, center: [10, 8] }}
      style={{ display: 'block', width, height, background: '#F0FAF6' }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({} as any)}
    >
      <Geographies geography={topoData as Record<string, unknown>}>
        {({ geographies }) =>
          geographies
            .filter(geo => String(geo.id) !== '10')
            .map(geo => {
              const slug = geoFeatureSlug(geo.id, geo.properties as Record<string, unknown>)
              const isVisited = !!slug && visitedSlugs.has(slug)
              return (
                <Geography
                  key={geo.rsmKey} geography={geo}
                  fill={isVisited ? '#2DBF8A' : '#C8CDD5'}
                  stroke="#FFFFFF" strokeWidth={0.5}
                  style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                />
              )
            })
        }
      </Geographies>
    </ComposableMap>
  )
}

export default function ShareModal({ isOpen, onClose, trips, topoData, user }: Props) {
  const { t, i18n } = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)

  const [stage,     setStage]     = useState<Stage>('settings')
  const [format,    setFormat]    = useState<FormatKey>('9:16')
  const [cardLang,  setCardLang]  = useState<CardLang>('en')
  const [dataUrl,   setDataUrl]   = useState<string | null>(null)
  const [blob,      setBlob]      = useState<Blob | null>(null)
  const [copied,    setCopied]    = useState(false)
  const [renderMap, setRenderMap] = useState(false)

  const visitedSlugs    = useMemo(() => new Set(trips.map(tr => tr.country)), [trips])
  const visitedSlugsArr = useMemo(() => [...visitedSlugs], [visitedSlugs])
  const uniqueCountries = visitedSlugs.size
  const totalDays       = useMemo(() => trips.reduce((s, tr) => s + tripDays(tr), 0), [trips])
  const displayName     = user?.user_metadata?.full_name as string | undefined

  const getCountryName = useCallback((slug: string): string => {
    const bundle = i18n.getResourceBundle(cardLang, 'translation') as { countries?: Record<string, string> }
    return bundle?.countries?.[slug] ?? slug
  }, [cardLang, i18n])

  useEffect(() => {
    if (isOpen) {
      const lng = (i18n.language?.slice(0, 2) ?? 'en') as CardLang
      setCardLang(CARD_LANGS.includes(lng) ? lng : 'en')
      setStage('settings')
      setDataUrl(null)
      setBlob(null)
      setRenderMap(false)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async () => {
    if (!cardRef.current || !topoData) return
    setRenderMap(true)
    setStage('generating')
    await new Promise(r => setTimeout(r, 1200))
    const { w, h } = FORMATS[format]
    try {
      const canvas = await html2canvas(cardRef.current, {
        width: w, height: h, scale: 1,
        useCORS: true, allowTaint: true,
        logging: false, backgroundColor: '#FFFFFF', imageTimeout: 0,
      })
      const url = canvas.toDataURL('image/png')
      const b   = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(x => (x ? res(x) : rej(new Error('toBlob'))), 'image/png'),
      )
      setDataUrl(url); setBlob(b); setStage('done')
    } catch (err) {
      console.error('[share] html2canvas error:', err)
      setStage('error')
    }
  }, [format, topoData])

  const download = useCallback(() => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.download = `visato-map-${format.replace(':', 'x')}.png`
    a.href = dataUrl; a.click()
  }, [dataUrl, format])

  const copy = useCallback(async () => {
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch (err) { console.error('[share] clipboard error:', err) }
  }, [blob])

  const backToSettings = useCallback(() => {
    setStage('settings'); setDataUrl(null); setBlob(null); setRenderMap(false)
  }, [])

  if (!isOpen) return null

  const { w, h } = FORMATS[format]
  const str = CARD_STR[cardLang]

  // ── Mini-card (horizontal: big number left, two-line label right) ────────
  // Used in both Stories and Horizontal layouts with different sizing.
  const miniCard = (
    value: number,
    line1: string,
    line2: string,
    numFont: number,
    labelFont: number,
    padH: number,
    padV: number,
    radius: number,
  ) => (
    <div style={{
      background: '#E8F8F2', borderRadius: radius,
      padding: `${padV}px ${padH}px`,
      display: 'flex', alignItems: 'center', gap: padH * 0.5,
    }}>
      <span style={{
        fontSize: numFont, fontWeight: 800, color: '#2DBF8A',
        lineHeight: 1, letterSpacing: '-0.04em', flexShrink: 0,
      }}>
        {value}
      </span>
      <div style={{
        fontSize: labelFont, color: '#6B7280', fontWeight: 600,
        textTransform: 'uppercase' as const, letterSpacing: '2px', lineHeight: 1.35,
      }}>
        <div>{line1}</div>
        {line2 && <div>{line2}</div>}
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // VERTICAL — Stories 1080 × 1920
  //
  // Measured from reference (second screenshot, ~600×1100px display):
  //   top pad   5%  →  96px
  //   header    4%  →  77px   (actual font ~46px + line)
  //   gap       8%  → 154px   (space-between distributes 4 gaps ≈ 110px each)
  //   map      32%  → 614px   (1080-136px horiz pad = 944px inner, scale 148)
  //   gap       8%
  //   stats    24%  → 461px   (big num col + two horiz mini-cards)
  //   gap       7%
  //   chips    12%  → 230px   (3 rows max)
  //   gap       5%
  //   footer    4%  →  77px   (name + mint underline)
  //   bot pad   5%  →  96px
  //
  //   justify-content:space-between fills the gaps automatically.
  // ─────────────────────────────────────────────────────────────────────────

  // Vertical card — adaptive: few countries (<3) vs many countries layout
  const fewCountries    = uniqueCountries < 3
  const avgTripDays     = trips.length > 0 ? Math.round(totalDays / trips.length) : 0
  const longestTripDays = trips.length > 0 ? Math.max(...trips.map(t => tripDays(t))) : 0
  const firstTripYear   = trips.length > 0
    ? Math.min(...trips.map(t => parseInt(t.entryDate.slice(0, 4), 10)))
    : new Date().getFullYear()

  // Canvas px at 1080px wide (≈3.6× the 300px preview spec)
  const V_MAP_H  = 460   // map height
  const V_MAP_W  = 936   // 1080 - 2×72 pad
  const V_NUM    = 200   // country count: weight 900
  const V_SLASH  = 54    // /195: weight 700
  const V_LBL    = 22    // COUNTRIES VISITED: weight 600
  const V_CARD_N = 90    // right mini-card number: weight 800
  const V_CARD_L = 18    // right mini-card label: weight 600

  const vertCard = (
    <div style={{
      width: 1080, height: 1350,
      background: '#FFFFFF',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '60px 72px',
      boxSizing: 'border-box',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    }}>

      {/* 1 — Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ fontSize: 54, fontWeight: 800, color: '#2DBF8A', letterSpacing: '-0.02em', lineHeight: 1, flexShrink: 0 }}>
          Visato
        </span>
        <div style={{ flex: 1, height: 3, background: '#2DBF8A', borderRadius: 2 }} />
      </div>

      {/* 2 — Map */}
      <div style={{ overflow: 'hidden', background: '#F0FAF6', height: V_MAP_H, flexShrink: 0, borderRadius: 36 }}>
        {renderMap && topoData
          ? <ShareMap topoData={topoData} visitedSlugs={visitedSlugs} width={V_MAP_W} height={V_MAP_H} scale={148} />
          : <div style={{ width: V_MAP_W, height: V_MAP_H, background: '#C8CDD5' }} />
        }
      </div>

      {/* 3 — Stats row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, lineHeight: 1 }}>
            <span style={{ fontSize: V_NUM, fontWeight: 900, color: '#2DBF8A', lineHeight: 1, letterSpacing: '-0.05em' }}>
              {uniqueCountries}
            </span>
            <span style={{ fontSize: V_SLASH, fontWeight: 700, color: '#9CA3AF', lineHeight: 1 }}>/195</span>
          </div>
          <div style={{ fontSize: V_LBL, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '6px', lineHeight: 1.4, marginTop: 40 }}>
            {str.countriesLine1} {str.countriesLine2}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flexShrink: 0, width: 220 }}>
          {([
            { value: totalDays,    l1: str.daysLine1,  l2: str.daysLine2  },
            { value: trips.length, l1: str.tripsLine1, l2: str.tripsLine2 },
          ] as { value: number; l1: string; l2: string }[]).map(({ value, l1, l2 }) => (
            <div key={l1} style={{
              background: '#F0FAF6', borderRadius: 28,
              height: 180,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center' as const, gap: 12,
            }}>
              <div style={{ fontSize: V_CARD_N, fontWeight: 800, color: '#2DBF8A', lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</div>
              <div style={{ fontSize: V_CARD_L, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '4px', lineHeight: 1.3, whiteSpace: 'nowrap' as const }}>
                {l1}{l2 && ` ${l2}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 — Country pills */}
      {fewCountries ? (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 20 }}>
          {visitedSlugsArr.map(slug => (
            <div key={slug} style={{
              display: 'flex', alignItems: 'center', gap: 18,
              background: '#F5F5F5', borderRadius: 72,
padding: '20px 36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,            }}>
              <span style={{ fontSize: 60, lineHeight: 1 }}>{COUNTRY_FLAGS[slug] ?? ''}</span>
              <span style={{ fontSize: 44, fontWeight: 600, color: '#374151', lineHeight: 1 }}>{getCountryName(slug)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 16 }}>
          {visitedSlugsArr.slice(0, 12).map(slug => (
            <div key={slug} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: '#F5F5F5', borderRadius: 72,
              padding: '20px 30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 36, lineHeight: 1 }}>{COUNTRY_FLAGS[slug] ?? ''}</span>
              <span style={{ fontSize: 28, fontWeight: 500, color: '#6B7280', lineHeight: 1 }}>{getCountryName(slug)}</span>
            </div>
          ))}
          {visitedSlugsArr.length > 12 && (
            <div style={{ display: 'flex', alignItems: 'center', background: '#F5F5F5', borderRadius: 72, padding: '16px 30px', fontSize: 32, fontWeight: 500, color: '#9CA3AF' }}>···</div>
          )}
        </div>
      )}

      {/* 5 — Extra stats (only when < 3 countries) */}
      {fewCountries && (
        <div style={{ display: 'flex', gap: 20 }}>
          {([
            { value: avgTripDays,     unit: 'days', label: 'AVG TRIP' },
            { value: longestTripDays, unit: 'days', label: 'LONGEST'  },
            { value: firstTripYear,   unit: '',     label: 'SINCE'    },
          ] as { value: number; unit: string; label: string }[]).map(({ value, unit, label }) => (
            <div key={label} style={{
              flex: 1, background: '#FFFFFF',
              border: '2px solid #E5E7EB', borderRadius: 36,
              padding: '36px 40px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 80, fontWeight: 800, color: '#2DBF8A', lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</span>
                {unit && <span style={{ fontSize: 26, fontWeight: 600, color: '#2DBF8A', lineHeight: 1 }}>{unit}</span>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '6px', lineHeight: 1.4, marginTop: 10 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 6 — Footer */}
      <div>
        <div style={{ height: 4, background: '#2DBF8A', opacity: 0.4, borderRadius: 2, marginBottom: 18 }} />
        {displayName && (
          <div style={{ fontSize: 48, fontWeight: 700, color: '#1F2937', lineHeight: 1.2 }}>{displayName}</div>
        )}
      </div>

    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // HORIZONTAL — 1200 × 675
  //   Left 56 %: map (672 × 675)     Right 44 %: stats panel (528 × 675)
  // ─────────────────────────────────────────────────────────────────────────
  const H_MAP_W = 672
  const H_PAN_W = 1200 - H_MAP_W   // 528
  const H_PAD_H = 40
  const H_PAD_V = 40

  const horizCard = (
    <div style={{
      width: 1200, height: 675,
      background: '#FFFFFF',
      display: 'flex', overflow: 'hidden',
      fontFamily: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
    }}>
      {/* Left: full-height map */}
      <div style={{ width: H_MAP_W, flexShrink: 0, overflow: 'hidden', background: '#F0FAF6' }}>
        {renderMap && topoData
          ? <ShareMap topoData={topoData} visitedSlugs={visitedSlugs}
              width={H_MAP_W} height={675} scale={112} />
          : <div style={{ width: H_MAP_W, height: 675, background: '#C8CDD5' }} />
        }
      </div>

      {/* Right: stats panel */}
      <div style={{
        width: H_PAN_W,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: `${H_PAD_V}px ${H_PAD_H}px`,
        boxSizing: 'border-box',
        borderLeft: '1px solid #E5E7EB',
      }}>
        {/* Visato + line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            fontSize: 24, fontWeight: 900, color: '#2DBF8A',
            letterSpacing: '-0.02em', lineHeight: 1, flexShrink: 0,
          }}>
            Visato
          </span>
          <div style={{ flex: 1, height: 2, background: '#2DBF8A', borderRadius: 1 }} />
        </div>

        {/* Stats: big number + two mini-cards */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          {/* Left: number + /195 column */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <span style={{
              fontSize: 96, fontWeight: 900, color: '#2DBF8A',
              lineHeight: 1, letterSpacing: '-0.06em', flexShrink: 0,
            }}>
              {uniqueCountries}
            </span>
            <div style={{ paddingBottom: 5 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#6B7280', lineHeight: 1.1 }}>
                /195
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#6B7280',
                textTransform: 'uppercase' as const, letterSpacing: '2.5px',
                lineHeight: 1.4, marginTop: 4,
              }}>
                <div>{str.countriesLine1}</div>
                <div>{str.countriesLine2}</div>
              </div>
            </div>
          </div>
          {/* Right: two mini-cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, width: 168 }}>
            {miniCard(totalDays,    str.daysLine1,  str.daysLine2,  36, 9, 14, 14, 12)}
            {miniCard(trips.length, str.tripsLine1, str.tripsLine2, 36, 9, 14, 14, 12)}
          </div>
        </div>

        {/* Chips */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 7,
          maxHeight: 96, overflow: 'hidden', alignContent: 'flex-start',
        }}>
          {visitedSlugsArr.map(slug => (
            <div key={slug} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#F0F1F3', borderRadius: 999,
              padding: '6px 12px', flexShrink: 0,
            }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{COUNTRY_FLAGS[slug] ?? ''}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', lineHeight: 1 }}>
                {getCountryName(slug)}
              </span>
            </div>
          ))}
        </div>

        {/* Name + underline */}
        <div>
          {displayName && (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1F2937', lineHeight: 1.2 }}>
                {displayName}
              </div>
              <div style={{ height: 2, background: '#2DBF8A', borderRadius: 1, marginTop: 6, width: '40%' }} />
            </>
          )}
        </div>
      </div>
    </div>
  )

  const cardInner = format === '9:16' ? vertCard : horizCard

  // ── Modal UI ──────────────────────────────────────────────────────────────
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: 999,
    border: active ? 'none' : '1.5px solid var(--color-border)',
    background: active ? '#2DBF8A' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-muted)',
    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'background 0.15s ease, color 0.15s ease',
  })

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.6875rem', fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    marginBottom: '0.5rem',
  }

  const actionBtn = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1.125rem', borderRadius: '0.5rem',
    fontSize: '0.8125rem', fontWeight: 600,
    cursor: active ? 'pointer' : 'not-allowed',
    opacity: active ? 1 : 0.45,
    fontFamily: 'Inter, system-ui, sans-serif',
    whiteSpace: 'nowrap', transition: 'opacity 0.15s ease',
  })

  return (
    <>
      {/* ── Off-screen share card ──────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{ position: 'fixed', left: -9999, top: -9999, width: w, height: h, overflow: 'hidden', zIndex: -1 }}
      >
        {cardInner}
      </div>

      {/* ── Modal overlay ──────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            background: 'var(--color-surface)',
            borderRadius: '1rem',
            padding: '1.5rem',
            width: '100%', maxWidth: '38rem',
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            maxHeight: '90vh', overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-heading)' }}>
              {t('share.title')}
            </span>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}
            >✕</button>
          </div>

          {/* ── Settings ──────────────────────────────────────────── */}
          {stage === 'settings' && (
            <div>
              <div style={{ marginBottom: '1.125rem' }}>
                <div style={sectionLabel}>{t('share.format')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FORMAT_KEYS.map(f => (
                    <button key={f} onClick={() => setFormat(f)} style={pillStyle(format === f)}>
                      {FORMATS[f].label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={sectionLabel}>{t('share.language')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {CARD_LANGS.map(lang => (
                    <button key={lang} onClick={() => setCardLang(lang)} style={pillStyle(cardLang === lang)}>
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={generate}
                disabled={!topoData}
                style={{
                  width: '100%', padding: '0.7rem 1.5rem',
                  borderRadius: '0.5rem', border: 'none',
                  background: '#2DBF8A', color: '#fff',
                  fontSize: '0.9375rem', fontWeight: 700,
                  cursor: topoData ? 'pointer' : 'not-allowed',
                  opacity: topoData ? 1 : 0.5,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'opacity 0.15s ease',
                }}
              >
                {t('share.generate')}
              </button>
              {!topoData && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Loading map data…
                </p>
              )}
            </div>
          )}

          {/* ── Generating spinner ────────────────────────────────── */}
          {stage === 'generating' && (
            <div style={{
              width: '100%', aspectRatio: `${w} / ${h}`, maxHeight: '55vh',
              borderRadius: '0.625rem', border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: '#2DBF8A' }}
              />
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                {t('share.generating')}
              </span>
            </div>
          )}

          {/* ── Done / Error ──────────────────────────────────────── */}
          {(stage === 'done' || stage === 'error') && (
            <>
              <div style={{
                width: '100%', aspectRatio: `${w} / ${h}`, maxHeight: '55vh',
                borderRadius: '0.625rem', overflow: 'hidden',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.125rem',
              }}>
                {stage === 'done' && dataUrl
                  ? <img src={dataUrl} alt="Share card preview" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                      Could not generate image — please try again
                    </span>
                }
              </div>
              <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={backToSettings}
                  style={{
                    padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                    border: '1.5px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-muted)',
                    fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ← {t('share.back')}
                </button>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                  <button onClick={download} disabled={stage !== 'done'}
                    style={{ ...actionBtn(stage === 'done'), border: '1.5px solid #2DBF8A', background: 'transparent', color: '#2DBF8A' }}>
                    {t('share.download')}
                  </button>
                  <button onClick={copy} disabled={stage !== 'done'}
                    style={{ ...actionBtn(stage === 'done'), border: 'none', background: '#2DBF8A', color: '#fff' }}>
                    {copied ? t('share.copied') : t('share.copy')}
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </>
  )
}
