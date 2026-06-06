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
  bg:          '#FFFFFF',
  accent:      '#2DBF8A',
  mapSection:  '#F8FFFE',
  mapOcean:    '#EBF7F3',
  visited:     '#2DBF8A',
  unvisited:   '#D4E8E0',
  statNum:     '#1A7A59',
  statLabel:   '#9CA3AF',
  statDivider: '#E5E7EB',
  headerRule:  '#F0F0F0',
  footerBg:    '#FAFAFA',
  logoColor:   '#2DBF8A',
  urlGray:     '#9CA3AF',
  footerText:  '#9CA3AF',
  headline:    '#1A7A59',
}

const LOCALES: Record<CardLang, string> = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' }

const CARD_STR: Record<CardLang, {
  countries: string
  trips: string
  days: string
  countryLabel: string  // used in 9:16 headline: "X countries visited"
}> = {
  en: {
    countries: 'Countries', trips: 'Trips', days: 'Days abroad',
    countryLabel: 'countries visited',
  },
  uk: {
    countries: 'Країни', trips: 'Поїздки', days: 'Днів за кордоном',
    countryLabel: 'країн відвідано',
  },
  ru: {
    countries: 'Страны', trips: 'Поездки', days: 'Дней за рубежом',
    countryLabel: 'стран посещено',
  },
}

export default function ShareModal({ isOpen, onClose, trips, topoData, user }: Props) {
  const { t, i18n } = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)

  const [stage,    setStage]    = useState<Stage>('settings')
  const [format,   setFormat]   = useState<FormatKey>('16:9')
  const [cardLang, setCardLang] = useState<CardLang>('en')
  const [dataUrl,  setDataUrl]  = useState<string | null>(null)
  const [blob,     setBlob]     = useState<Blob | null>(null)
  const [copied,   setCopied]   = useState(false)

  const visitedSlugs    = useMemo(() => new Set(trips.map(t => t.country)), [trips])
  const uniqueCountries = visitedSlugs.size
  const totalDays       = useMemo(() => trips.reduce((s, t) => s + tripDays(t), 0), [trips])
  const displayName     = user?.user_metadata?.full_name as string | undefined

  useEffect(() => {
    if (!isOpen) return
    const lng = (i18n.language?.slice(0, 2) ?? 'en') as CardLang
    setCardLang(CARD_LANGS.includes(lng) ? lng : 'en')
    setStage('settings')
    setDataUrl(null)
    setBlob(null)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async () => {
    if (!cardRef.current) return
    setStage('generating')
    await new Promise(r => setTimeout(r, 800))
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
      console.error('[share]', err); setStage('error')
    }
  }, [format])

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
      console.error('[share] clipboard write failed', err)
    }
  }, [blob])

  const backToSettings = useCallback(() => {
    setStage('settings'); setDataUrl(null); setBlob(null)
  }, [])

  if (!isOpen) return null

  const { w, h } = FORMATS[format]
  const str      = CARD_STR[cardLang]
  const cardDate = new Date().toLocaleDateString(LOCALES[cardLang], { month: 'long', year: 'numeric' })

  const statsItems = [
    { n: uniqueCountries, label: str.countries },
    { n: totalDays,       label: str.days      },
    { n: trips.length,    label: str.trips     },
  ]

  // ── Modal UI style helpers ───────────────────────────────────────────
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

  // ── Card building blocks ─────────────────────────────────────────────

  // 6px mint accent bar — full width, very top
  const AccentBar = (
    <div style={{ width: w, height: 6, background: L.accent, flexShrink: 0 }} />
  )

  // Header row: "🌍 Visato" left | "visato.app" right
  const CardHeader = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '26px 36px', flexShrink: 0, background: L.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>🌍</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: L.logoColor, letterSpacing: '-0.02em' }}>
          Visato
        </span>
      </div>
      <span style={{ fontSize: 13, color: L.urlGray, fontWeight: 600, letterSpacing: '0.04em' }}>
        visato.app
      </span>
    </div>
  )

  // Thin rule
  const HRule = (
    <div style={{ width: w, height: 1, background: L.headerRule, flexShrink: 0 }} />
  )

  // World map inside a mint-tinted section
  const CardMap = ({ mapH, scale = 155 }: { mapH: number; scale?: number }) => (
    <div style={{ width: w, height: mapH, background: L.mapSection, flexShrink: 0, overflow: 'hidden' }}>
      <ComposableMap
        width={w} height={mapH}
        projectionConfig={{ scale, center: [10, 8] }}
        style={{ display: 'block', width: '100%', height: '100%', background: L.mapOcean }}
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
                    stroke={L.mapOcean} strokeWidth={0.5}
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

  // Stats row: three items with 1px vertical dividers between them
  const StatsSection = ({
    numSize = 48,
    padV    = 32,
    statGap = 52,
  }: {
    numSize?: number
    padV?: number
    statGap?: number
  }) => {
    const nodes: React.ReactNode[] = []
    statsItems.forEach((item, i) => {
      if (i > 0) {
        nodes.push(
          <div
            key={`div-${i}`}
            style={{
              width: 1, height: 54, background: L.statDivider,
              flexShrink: 0, margin: `0 ${statGap}px`,
            }}
          />,
        )
      }
      nodes.push(
        <div key={`stat-${i}`} style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: numSize, fontWeight: 700, color: L.statNum,
            lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 9,
          }}>
            {item.n}
          </div>
          <div style={{
            fontSize: 11, color: L.statLabel, fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: '3px',
          }}>
            {item.label}
          </div>
        </div>,
      )
    })
    return (
      <div style={{
        flex: 1, background: L.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: `${padV}px 48px`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {nodes}
        </div>
      </div>
    )
  }

  // Footer bar: user name left, date right
  const FooterBar = (
    <div style={{
      flexShrink: 0,
      padding: '18px 36px',
      background: L.footerBg,
      borderTop: `1px solid ${L.headerRule}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 13, color: L.footerText, fontStyle: 'italic', fontWeight: 400 }}>
        {displayName ? `— ${displayName}` : ''}
      </span>
      <span style={{ fontSize: 13, color: L.footerText, fontWeight: 500 }}>
        {cardDate}
      </span>
    </div>
  )

  // 9:16-only headline block: large number + "countries visited"
  const HeadlineSection = (
    <div style={{
      flexShrink: 0,
      padding: '44px 48px 36px',
      background: L.bg,
    }}>
      <div style={{
        fontSize: 64, fontWeight: 900, color: L.headline,
        lineHeight: 1, letterSpacing: '-0.05em', marginBottom: 10,
      }}>
        {uniqueCountries}
      </div>
      <div style={{
        fontSize: 30, fontWeight: 700, color: L.headline,
        lineHeight: 1.1, letterSpacing: '-0.01em',
      }}>
        {str.countryLabel}
      </div>
    </div>
  )

  // ── Card layout per format ────────────────────────────────────────────

  // Map height as ~55% of card, slightly less for 9:16 to leave room for headline
  const mapH = format === '9:16'
    ? Math.round(h * 0.47)   // 1080×1920 → ~902px
    : Math.round(h * 0.55)   // 371 / 594 / 743px for 16:9 / 1:1 / 4:5

  let cardInner: React.ReactNode

  if (format === '16:9') {
    cardInner = (
      <>
        {AccentBar}
        {CardHeader}
        {HRule}
        <CardMap mapH={mapH} scale={135} />
        <StatsSection numSize={46} padV={24} statGap={44} />
        {FooterBar}
      </>
    )
  } else if (format === '1:1') {
    cardInner = (
      <>
        {AccentBar}
        {CardHeader}
        {HRule}
        <CardMap mapH={mapH} scale={155} />
        <StatsSection numSize={48} padV={32} statGap={48} />
        {FooterBar}
      </>
    )
  } else if (format === '4:5') {
    cardInner = (
      <>
        {AccentBar}
        {CardHeader}
        {HRule}
        <CardMap mapH={mapH} scale={165} />
        <StatsSection numSize={56} padV={44} statGap={52} />
        {FooterBar}
      </>
    )
  } else {
    // 9:16 — includes headline above map
    cardInner = (
      <>
        {AccentBar}
        {CardHeader}
        {HRule}
        {HeadlineSection}
        {HRule}
        <CardMap mapH={mapH} scale={175} />
        <StatsSection numSize={60} padV={52} statGap={60} />
        {FooterBar}
      </>
    )
  }

  // ── Modal UI ─────────────────────────────────────────────────────────
  const actionBtn = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1.125rem', borderRadius: '0.5rem',
    fontSize: '0.8125rem', fontWeight: 600,
    cursor: active ? 'pointer' : 'not-allowed',
    opacity: active ? 1 : 0.45,
    fontFamily: 'Inter, system-ui, sans-serif',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s ease',
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
          fontFamily: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
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
                color: 'var(--color-text-muted)', fontSize: '1.125rem',
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
            </div>
          )}

          {/* ── Generating ────────────────────────────────────────────── */}
          {stage === 'generating' && (
            <div style={{
              width: '100%',
              aspectRatio: `${w} / ${h}`,
              maxHeight: '55vh',
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
                width: '100%',
                aspectRatio: `${w} / ${h}`,
                maxHeight: '55vh',
                borderRadius: '0.625rem', overflow: 'hidden',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.125rem',
              }}>
                {stage === 'done' && dataUrl
                  ? <img
                      src={dataUrl}
                      alt="Share card preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                      Could not generate image
                    </span>
                }
              </div>

              <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={backToSettings}
                  style={{
                    padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                    border: '1.5px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ← {t('share.back')}
                </button>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                  <button
                    onClick={download}
                    disabled={stage !== 'done'}
                    style={{
                      ...actionBtn(stage === 'done'),
                      border: '1.5px solid #2DBF8A',
                      background: 'transparent',
                      color: '#2DBF8A',
                    }}
                  >
                    {t('share.download')}
                  </button>
                  <button
                    onClick={copy}
                    disabled={stage !== 'done'}
                    style={{
                      ...actionBtn(stage === 'done'),
                      border: 'none',
                      background: '#2DBF8A',
                      color: '#fff',
                    }}
                  >
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
