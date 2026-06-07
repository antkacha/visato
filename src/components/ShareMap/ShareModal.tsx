import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import html2canvas from 'html2canvas'
import type { User } from '@supabase/supabase-js'
import type { TripEntry } from '../../types'
import { geoFeatureSlug } from '../../constants/countryIsoMap'
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

type FormatKey = '16:9' | '1:1' | '4:5' | '9:16'
type CardLang  = 'en' | 'uk' | 'ru'
type Stage     = 'settings' | 'generating' | 'done' | 'error'

const FORMATS: Record<FormatKey, { w: number; h: number }> = {
  '16:9': { w: 1200, h: 675  },
  '1:1':  { w: 1080, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
}

const FORMAT_KEYS: FormatKey[] = ['16:9', '1:1', '4:5', '9:16']
const CARD_LANGS: CardLang[]   = ['en', 'uk', 'ru']

// ── Light card design tokens ─────────────────────────────────────────
const L = {
  bg:        '#FFFFFF',
  border:    '#E5E7EB',
  mint:      '#2DBF8A',
  dark:      '#1F2937',
  gray:      '#6B7280',
  mapBg:     '#FFFFFF',
  unvisited: '#E5E7EB',
  visited:   '#2DBF8A',
}

const LOCALES: Record<CardLang, string> = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' }

const CARD_STR: Record<CardLang, {
  line1: string
  line2a: string  // dark portion of line 2
  line2b: string  // mint portion of line 2
  countriesLabel: string
  daysLabel: string
  tripsLabel: string
}> = {
  en: {
    line1: 'The world is big.',
    line2a: 'My list is ',
    line2b: 'growing.',
    countriesLabel: 'Countries Visited',
    daysLabel: 'Days Abroad',
    tripsLabel: 'Trips Taken',
  },
  uk: {
    line1: 'Світ великий.',
    line2a: 'Мій список ',
    line2b: 'росте.',
    countriesLabel: 'Відвідано країн',
    daysLabel: 'Днів за кордоном',
    tripsLabel: 'Поїздок',
  },
  ru: {
    line1: 'Мир велик.',
    line2a: 'Мой список ',
    line2b: 'растёт.',
    countriesLabel: 'Посещено стран',
    daysLabel: 'Дней за рубежом',
    tripsLabel: 'Поездок',
  },
}

export default function ShareModal({ isOpen, onClose, trips, topoData, user }: Props) {
  const { t, i18n } = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)

  const [stage,     setStage]     = useState<Stage>('settings')
  const [format,    setFormat]    = useState<FormatKey>('16:9')
  const [cardLang,  setCardLang]  = useState<CardLang>('en')
  const [dataUrl,   setDataUrl]   = useState<string | null>(null)
  const [blob,      setBlob]      = useState<Blob | null>(null)
  const [copied,    setCopied]    = useState(false)
  // ComposableMap only mounts after Generate is clicked (prevents crash with null topoData)
  const [renderMap, setRenderMap] = useState(false)

  const visitedSlugs    = useMemo(() => new Set(trips.map(t => t.country)), [trips])
  const uniqueCountries = visitedSlugs.size
  const totalDays       = useMemo(() => trips.reduce((s, t) => s + tripDays(t), 0), [trips])
  const displayName     = user?.user_metadata?.full_name as string | undefined

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
    await new Promise(r => setTimeout(r, 1000))
    const { w, h } = FORMATS[format]
    try {
      const canvas = await html2canvas(cardRef.current, {
        width: w, height: h, scale: 1,
        useCORS: true, allowTaint: true,
        logging: false, backgroundColor: L.bg, imageTimeout: 0,
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
    } catch (err) {
      console.error('[share] clipboard error:', err)
    }
  }, [blob])

  const backToSettings = useCallback(() => {
    setStage('settings'); setDataUrl(null); setBlob(null); setRenderMap(false)
  }, [])

  if (!isOpen) return null

  const { w, h } = FORMATS[format]
  const str      = CARD_STR[cardLang]
  const cardDate = new Date().toLocaleDateString(LOCALES[cardLang], { month: 'long', year: 'numeric' })

  // ── Card building helpers (plain functions, NOT React components) ─────

  // Centered "Visato" text flanked by horizontal rules
  const brandBar = (padH = 40) => (
    <div style={{ padding: `32px ${padH}px 20px`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, height: 1, background: L.border }} />
        <span style={{ fontSize: 20, fontWeight: 900, color: L.mint, letterSpacing: '-0.02em' }}>
          Visato
        </span>
        <div style={{ flex: 1, height: 1, background: L.border }} />
      </div>
    </div>
  )

  // Two-line headline — second line has mint-colored last word
  const headlineBlock = (padH = 40, fontSize = 48) => (
    <div style={{ padding: `0 ${padH}px 28px`, flexShrink: 0 }}>
      <div style={{
        fontSize, fontWeight: 900, color: L.dark,
        lineHeight: 1.15, letterSpacing: '-0.03em',
      }}>
        {str.line1}
      </div>
      <div style={{
        fontSize, fontWeight: 900,
        lineHeight: 1.15, letterSpacing: '-0.03em',
        marginTop: 6,
      }}>
        <span style={{ color: L.dark }}>{str.line2a}</span>
        <span style={{ color: L.mint }}>{str.line2b}</span>
      </div>
    </div>
  )

  // World map with 24px side padding; placeholder until renderMap is true
  const mapBlock = (mapH: number, scale: number, innerW = w - 48) => {
    if (!renderMap || !topoData) {
      return (
        <div style={{ padding: '0 24px', flexShrink: 0 }}>
          <div style={{ height: mapH, background: L.unvisited }} />
        </div>
      )
    }
    return (
      <div style={{ padding: '0 24px', flexShrink: 0 }}>
        <ComposableMap
          width={innerW} height={mapH}
          projectionConfig={{ scale, center: [10, 8] }}
          style={{ display: 'block', width: innerW, height: mapH, background: L.mapBg }}
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
                      fill={isVisited ? L.visited : L.unvisited}
                      stroke={L.bg} strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover:   { outline: 'none' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  )
                })
            }
          </Geographies>
        </ComposableMap>
      </div>
    )
  }

  // Three stats row, left-aligned
  const statsBlock = (padH = 40, numSize = 72, gap = 44) => {
    const of195Size = Math.round(numSize * 0.32)
    return (
      <div style={{ padding: `32px ${padH}px 24px`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap, alignItems: 'flex-start' }}>
          {/* Countries */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{
                fontSize: numSize, fontWeight: 900, color: L.mint,
                lineHeight: 1, letterSpacing: '-0.04em',
              }}>
                {uniqueCountries}
              </span>
              <span style={{ fontSize: of195Size, color: L.gray, fontWeight: 600 }}>
                /195
              </span>
            </div>
            <div style={{
              fontSize: 11, color: L.gray, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '2px', marginTop: 8,
            }}>
              {str.countriesLabel}
            </div>
          </div>
          {/* Days */}
          <div>
            <div style={{
              fontSize: numSize, fontWeight: 900, color: L.mint,
              lineHeight: 1, letterSpacing: '-0.04em',
            }}>
              {totalDays}
            </div>
            <div style={{
              fontSize: 11, color: L.gray, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '2px', marginTop: 8,
            }}>
              {str.daysLabel}
            </div>
          </div>
          {/* Trips */}
          <div>
            <div style={{
              fontSize: numSize, fontWeight: 900, color: L.mint,
              lineHeight: 1, letterSpacing: '-0.04em',
            }}>
              {trips.length}
            </div>
            <div style={{
              fontSize: 11, color: L.gray, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '2px', marginTop: 8,
            }}>
              {str.tripsLabel}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Footer: name + date + visato.app
  const footerBlock = (padH = 40) => (
    <div style={{
      flex: 1, padding: `20px ${padH}px 32px`,
      borderTop: `1px solid ${L.border}`,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6,
    }}>
      {displayName && (
        <div style={{ fontSize: 15, color: L.dark, fontWeight: 500 }}>
          {displayName}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: L.gray }}>{cardDate}</span>
        <span style={{ fontSize: 13, color: L.gray, fontWeight: 600, letterSpacing: '0.04em' }}>
          visato.app
        </span>
      </div>
    </div>
  )

  // ── Card layouts ──────────────────────────────────────────────────────
  let cardInner: React.ReactNode

  if (format === '4:5') {
    // 1080×1350: brandBar + headline + map(680) + stats + footer(flex:1)
    cardInner = (
      <>
        {brandBar(40)}
        {headlineBlock(40, 48)}
        {mapBlock(680, 165)}
        {statsBlock(40, 72, 44)}
        {footerBlock(40)}
      </>
    )

  } else if (format === '9:16') {
    // 1080×1920: brandBar + headline + map(1050) + stats + footer(flex:1)
    cardInner = (
      <>
        {brandBar(44)}
        {headlineBlock(44, 54)}
        {mapBlock(1050, 185)}
        {statsBlock(44, 80, 48)}
        {footerBlock(44)}
      </>
    )

  } else if (format === '1:1') {
    // 1080×1080: brandBar + headline + map(380) + stats + footer(flex:1)
    cardInner = (
      <>
        {brandBar(40)}
        {headlineBlock(40, 38)}
        {mapBlock(380, 145)}
        {statsBlock(40, 60, 36)}
        {footerBlock(40)}
      </>
    )

  } else {
    // 16:9 (1200×675): map left column 58% | brand+headline+stats right 42%
    const mapColW = Math.round(w * 0.58) // 696px
    const innerMapW = mapColW - 0  // full width in this column (no extra padding)
    cardInner = (
      <div style={{ display: 'flex', height: h }}>
        {/* Left: full-height map */}
        <div style={{ width: mapColW, flexShrink: 0, overflow: 'hidden', borderRight: `1px solid ${L.border}` }}>
          {renderMap && topoData ? (
            <ComposableMap
              width={innerMapW} height={h}
              projectionConfig={{ scale: 125, center: [10, 8] }}
              style={{ display: 'block', width: innerMapW, height: h, background: L.mapBg }}
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
                          fill={isVisited ? L.visited : L.unvisited}
                          stroke={L.bg} strokeWidth={0.5}
                          style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                        />
                      )
                    })
                }
              </Geographies>
            </ComposableMap>
          ) : (
            <div style={{ width: mapColW, height: h, background: L.unvisited }} />
          )}
        </div>

        {/* Right: brand + headline + stats + footer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {brandBar(32)}
          {headlineBlock(32, 34)}
          {statsBlock(32, 52, 28)}
          {footerBlock(32)}
        </div>
      </div>
    )
  }

  // ── Modal UI ──────────────────────────────────────────────────────────
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 999,
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
      {/* ── Off-screen share card ─────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          position: 'fixed', left: -9999, top: -9999,
          width: w, height: h,
          background: L.bg,
          border: `1px solid ${L.border}`,
          borderRadius: 24,
          fontFamily: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          zIndex: -1,
        }}
      >
        {cardInner}
      </div>

      {/* ── Modal overlay ─────────────────────────────────────────────── */}
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
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1.25rem',
          }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-heading)' }}>
              {t('share.title')}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: '1.25rem',
                lineHeight: 1, padding: '0.25rem',
              }}
            >✕</button>
          </div>

          {/* ── Settings ──────────────────────────────────────────────── */}
          {stage === 'settings' && (
            <div>
              <div style={{ marginBottom: '1.125rem' }}>
                <div style={sectionLabel}>{t('share.format')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FORMAT_KEYS.map(f => (
                    <button key={f} onClick={() => setFormat(f)} style={pillStyle(format === f)}>{f}</button>
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

          {/* ── Generating spinner ────────────────────────────────────── */}
          {stage === 'generating' && (
            <div style={{
              width: '100%', aspectRatio: `${w} / ${h}`, maxHeight: '55vh',
              borderRadius: '0.625rem',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  border: '3px solid var(--color-border)',
                  borderTopColor: '#2DBF8A',
                }}
              />
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                {t('share.generating')}
              </span>
            </div>
          )}

          {/* ── Done / Error ──────────────────────────────────────────── */}
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
                  ? <img src={dataUrl} alt="Share card preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
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
