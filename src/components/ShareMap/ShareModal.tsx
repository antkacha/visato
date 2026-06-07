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

// Stories vertical 1080×1920, landscape horizontal 1200×675
const FORMATS: Record<FormatKey, { w: number; h: number; label: string }> = {
  '9:16': { w: 1080, h: 1920, label: 'Stories'    },
  '16:9': { w: 1200, h: 675,  label: 'Horizontal' },
}

const FORMAT_KEYS: FormatKey[] = ['9:16', '16:9']
const CARD_LANGS: CardLang[]   = ['en', 'uk', 'ru']

const CARD_STR: Record<CardLang, { countriesLabel: string; daysLabel: string; tripsLabel: string }> = {
  en: { countriesLabel: 'COUNTRIES VISITED', daysLabel: 'DAYS ABROAD',      tripsLabel: 'TRIPS TAKEN' },
  uk: { countriesLabel: 'ВІДВІДАНО КРАЇН',   daysLabel: 'ДНІВ ЗА КОРДОНОМ', tripsLabel: 'ПОЇЗДОК'    },
  ru: { countriesLabel: 'ПОСЕЩЕНО СТРАН',    daysLabel: 'ДНЕЙ ЗА РУБЕЖОМ',  tripsLabel: 'ПОЕЗДОК'    },
}

// ── Shared flat map ──────────────────────────────────────────────────────────
function ShareMap({
  topoData, visitedSlugs, width, height, scale, bg = '#F0FAF6',
}: {
  topoData: unknown; visitedSlugs: Set<string>
  width: number; height: number; scale: number; bg?: string
}) {
  return (
    <ComposableMap
      width={width} height={height}
      projectionConfig={{ scale, center: [10, 8] }}
      style={{ display: 'block', width, height, background: bg }}
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
                  fill={isVisited ? '#2DBF8A' : '#D1D5DB'}
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

  // ─────────────────────────────────────────────────────────────────────────
  // VERTICAL — Stories 1080 × 1920
  //
  // Proportions derived from the reference:
  //   header  ≈ 2%   →  ~38px
  //   gap     ≈ 6%   →  ~115px  (space-between distributes 4 gaps evenly)
  //   map     ≈ 30%  →  ~576px
  //   stats   ≈ 27%  →  ~518px  (big number + two side cards)
  //   chips   ≈ 18%  →  ~346px  capped at 3 rows with overflow:hidden
  //   name    ≈ 5%   →  ~96px
  //   padding ≈ 12%  →  top 80px + bottom 80px
  // ─────────────────────────────────────────────────────────────────────────
  const V = {
    padV: 80,  // top / bottom padding
    padH: 68,  // left / right padding  →  innerW = 1080 - 136 = 944px
    mapH: 580,
    mapScale: 152,
    numFont: 192,   // big country count
    slash195Font: 58,
    labelFont: 18,
    labelSpacing: '3.5px',
    cardW: 342,     // right mini-card width
    cardNumFont: 78,
    cardLabelFont: 15,
    chipFlagPx: 30,
    chipNamePx: 22,
    chipPadH: 20,
    chipPadV: 11,
    chipGap: 12,
    chipMaxH: 186,  // 3 rows: 3×(11+30+11) + 2×12 = 3×52 + 24 = 180 ≈ 186
    nameFont: 34,
  } as const

  const innerW = 1080 - V.padH * 2  // 944px

  const vertCard = (
    <div style={{
      width: 1080, height: 1920,
      background: '#FFFFFF',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: `${V.padV}px ${V.padH}px`,
      boxSizing: 'border-box',
      fontFamily: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
    }}>

      {/* 1 ── Visato + mint line ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <span style={{
          fontSize: 46, fontWeight: 900, color: '#2DBF8A',
          letterSpacing: '-0.02em', lineHeight: 1, flexShrink: 0,
        }}>
          Visato
        </span>
        <div style={{ flex: 1, height: 3, background: '#2DBF8A', borderRadius: 2 }} />
      </div>

      {/* 2 ── World map ──────────────────────────────────────────────── */}
      <div style={{ borderRadius: 20, overflow: 'hidden', background: '#F0FAF6', height: V.mapH, flexShrink: 0 }}>
        {renderMap && topoData
          ? <ShareMap topoData={topoData} visitedSlugs={visitedSlugs} width={innerW} height={V.mapH} scale={V.mapScale} />
          : <div style={{ width: innerW, height: V.mapH, background: '#D1D5DB' }} />
        }
      </div>

      {/* 3 ── Stats: big country number (left) + two cards (right) ───── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28 }}>

        {/* Left: huge number */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{
              fontSize: V.numFont, fontWeight: 900, color: '#2DBF8A',
              lineHeight: 0.88, letterSpacing: '-0.06em',
            }}>
              {uniqueCountries}
            </span>
            <span style={{ fontSize: V.slash195Font, color: '#6B7280', fontWeight: 600, lineHeight: 1 }}>
              /195
            </span>
          </div>
          <div style={{
            fontSize: V.labelFont, color: '#6B7280', fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: V.labelSpacing,
            marginTop: 20, lineHeight: 1.3,
          }}>
            {str.countriesLabel}
          </div>
        </div>

        {/* Right: days + trips cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: V.cardW }}>
          {[
            { value: totalDays,    label: str.daysLabel  },
            { value: trips.length, label: str.tripsLabel },
          ].map(({ value, label }) => (
            <div key={label} style={{ background: '#E8F5F0', borderRadius: 20, padding: '24px 28px' }}>
              <div style={{
                fontSize: V.cardNumFont, fontWeight: 900, color: '#2DBF8A',
                lineHeight: 1, letterSpacing: '-0.04em',
              }}>
                {value}
              </div>
              <div style={{
                fontSize: V.cardLabelFont, color: '#1A7A59', fontWeight: 700,
                textTransform: 'uppercase' as const, letterSpacing: '2.5px',
                marginTop: 10, lineHeight: 1.3,
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 ── Country chips — max 3 rows ─────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: V.chipGap,
        maxHeight: V.chipMaxH, overflow: 'hidden', alignContent: 'flex-start',
      }}>
        {visitedSlugsArr.map(slug => (
          <div key={slug} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: '#F3F4F6', borderRadius: 999,
            padding: `${V.chipPadV}px ${V.chipPadH}px`, flexShrink: 0,
          }}>
            <span style={{ fontSize: V.chipFlagPx, lineHeight: 1 }}>{COUNTRY_FLAGS[slug] ?? ''}</span>
            <span style={{ fontSize: V.chipNamePx, fontWeight: 500, color: '#374151', lineHeight: 1 }}>
              {getCountryName(slug)}
            </span>
          </div>
        ))}
      </div>

      {/* 5 ── User name ──────────────────────────────────────────────── */}
      <div>
        {displayName && (
          <div style={{ fontSize: V.nameFont, fontWeight: 700, color: '#1F2937', lineHeight: 1.2 }}>
            {displayName}
          </div>
        )}
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // HORIZONTAL — 1200 × 675
  //   Left 56 %: map (672px)   Right 44 %: stats panel (528px)
  //   Right panel uses same section order with sizes scaled to ~55 % of Stories
  // ─────────────────────────────────────────────────────────────────────────
  const mapColW = 672
  const panelW  = 1200 - mapColW  // 528px

  const H = {
    padV: 44,
    padH: 40,
    numFont: 100,
    slash195Font: 30,
    labelFont: 10,
    labelSpacing: '2.5px',
    cardW: 176,
    cardNumFont: 40,
    cardLabelFont: 9,
    chipFlagPx: 16,
    chipNamePx: 12,
    chipPadH: 12,
    chipPadV: 7,
    chipGap: 7,
    chipMaxH: 102,  // 3 rows: 3×(7+16+7) + 2×7 = 3×30 + 14 = 104
    nameFont: 18,
  } as const

  const horizCard = (
    <div style={{
      width: 1200, height: 675,
      background: '#FFFFFF',
      display: 'flex', overflow: 'hidden',
      fontFamily: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
    }}>

      {/* Left: full-height map */}
      <div style={{ width: mapColW, flexShrink: 0, overflow: 'hidden', background: '#F0FAF6' }}>
        {renderMap && topoData
          ? <ShareMap topoData={topoData} visitedSlugs={visitedSlugs} width={mapColW} height={675} scale={115} />
          : <div style={{ width: mapColW, height: 675, background: '#D1D5DB' }} />
        }
      </div>

      {/* Right: stats panel */}
      <div style={{
        width: panelW,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: `${H.padV}px ${H.padH}px`,
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

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: H.numFont, fontWeight: 900, color: '#2DBF8A',
                lineHeight: 0.88, letterSpacing: '-0.06em',
              }}>
                {uniqueCountries}
              </span>
              <span style={{ fontSize: H.slash195Font, color: '#6B7280', fontWeight: 600, lineHeight: 1 }}>
                /195
              </span>
            </div>
            <div style={{
              fontSize: H.labelFont, color: '#6B7280', fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: H.labelSpacing,
              marginTop: 10, lineHeight: 1.3,
            }}>
              {str.countriesLabel}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: H.cardW }}>
            {[
              { value: totalDays,    label: str.daysLabel  },
              { value: trips.length, label: str.tripsLabel },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: '#E8F5F0', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{
                  fontSize: H.cardNumFont, fontWeight: 900, color: '#2DBF8A',
                  lineHeight: 1, letterSpacing: '-0.04em',
                }}>
                  {value}
                </div>
                <div style={{
                  fontSize: H.cardLabelFont, color: '#1A7A59', fontWeight: 700,
                  textTransform: 'uppercase' as const, letterSpacing: '1.5px',
                  marginTop: 6, lineHeight: 1.3,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Country chips */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: H.chipGap,
          maxHeight: H.chipMaxH, overflow: 'hidden', alignContent: 'flex-start',
        }}>
          {visitedSlugsArr.map(slug => (
            <div key={slug} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#F3F4F6', borderRadius: 999,
              padding: `${H.chipPadV}px ${H.chipPadH}px`, flexShrink: 0,
            }}>
              <span style={{ fontSize: H.chipFlagPx, lineHeight: 1 }}>{COUNTRY_FLAGS[slug] ?? ''}</span>
              <span style={{ fontSize: H.chipNamePx, fontWeight: 500, color: '#374151', lineHeight: 1 }}>
                {getCountryName(slug)}
              </span>
            </div>
          ))}
        </div>

        {/* User name */}
        <div>
          {displayName && (
            <div style={{ fontSize: H.nameFont, fontWeight: 700, color: '#1F2937', lineHeight: 1.2 }}>
              {displayName}
            </div>
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
