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

// ── Dark design tokens (all formats) ────────────────────────────────
const D = {
  bg:        '#0D1F1A',
  mapBg:     '#162820',
  unvisited: '#1E3D30',
  visited:   '#2DBF8A',
  mint:      '#2DBF8A',
  white:     '#FFFFFF',
  gray:      'rgba(255,255,255,0.45)',
  dimMint20: 'rgba(45,191,138,0.20)',
  dimMint30: 'rgba(45,191,138,0.30)',
  ticker:    '#2DBF8A',
  tickerTxt: '#0D1F1A',
}

const LOCALES: Record<CardLang, string> = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' }

const CARD_STR: Record<CardLang, {
  countries: string
  trips: string
  days: string
  year: string
}> = {
  en: { countries: 'Countries', trips: 'Trips', days: 'Days abroad', year: 'Year' },
  uk: { countries: 'Країни',    trips: 'Поїздки', days: 'Днів за кордоном', year: 'Рік'  },
  ru: { countries: 'Страны',    trips: 'Поездки', days: 'Дней за рубежом',  year: 'Год'  },
}

const TICKER_CHUNK = '  ✈  VISATO  ✈  MY TRAVEL MAP'

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
        logging: false, backgroundColor: D.bg, imageTimeout: 0,
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

  const { w, h }   = FORMATS[format]
  const str        = CARD_STR[cardLang]
  const currentYear = new Date().getFullYear()
  const cardDate    = new Date().toLocaleDateString(LOCALES[cardLang], { month: 'long', year: 'numeric' })

  // Flags for visited countries (deduplicated, emoji only)
  const flagList = useMemo(() =>
    [...visitedSlugs]
      .map(slug => COUNTRY_FLAGS[slug])
      .filter(Boolean) as string[]
  , [visitedSlugs])

  // ── Modal UI helpers ─────────────────────────────────────────────────
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

  // ── Shared card sub-components ───────────────────────────────────────

  // Dark header: 🌍 Visato left | visato.app right
  const DarkHeader = ({ padH = 48, logoSize = 20 }: { padH?: number; logoSize?: number }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `26px ${padH}px`, flexShrink: 0, background: D.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: logoSize, lineHeight: 1 }}>🌍</span>
        <span style={{ fontSize: logoSize, fontWeight: 900, color: D.mint, letterSpacing: '-0.02em' }}>
          Visato
        </span>
      </div>
      <span style={{ fontSize: 13, color: D.gray, fontWeight: 600, letterSpacing: '0.05em' }}>
        visato.app
      </span>
    </div>
  )

  // Map with dark palette
  const DarkMap = ({ mapH, scale = 160, mapW = w }: { mapH: number; scale?: number; mapW?: number }) => (
    <div style={{ width: mapW, height: mapH, background: D.mapBg, flexShrink: 0, overflow: 'hidden' }}>
      <ComposableMap
        width={mapW} height={mapH}
        projectionConfig={{ scale, center: [10, 8] }}
        style={{ display: 'block', width: '100%', height: '100%', background: D.mapBg }}
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
                    fill={isVisited ? D.visited : D.unvisited}
                    stroke={D.bg} strokeWidth={0.5}
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

  // Horizontal 3-stat row for non-9:16
  const DarkStatRow = ({
    numSize = 48, padV = 32, padH = 48, gap = 48,
  }: { numSize?: number; padV?: number; padH?: number; gap?: number }) => {
    const items = [
      { n: uniqueCountries, label: str.countries },
      { n: totalDays,       label: str.days      },
      { n: trips.length,    label: str.trips     },
    ]
    const nodes: React.ReactNode[] = []
    items.forEach((item, i) => {
      if (i > 0) nodes.push(
        <div key={`d${i}`} style={{
          width: 1, height: 52, background: D.dimMint20,
          flexShrink: 0, margin: `0 ${gap}px`,
        }} />,
      )
      nodes.push(
        <div key={`s${i}`} style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: numSize, fontWeight: 900, color: D.white,
            lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 10,
          }}>
            {item.n}
          </div>
          <div style={{
            fontSize: 11, color: D.mint, fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: '3px',
          }}>
            {item.label}
          </div>
        </div>,
      )
    })
    return (
      <div style={{
        flex: 1, background: D.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: `${padV}px ${padH}px`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {nodes}
        </div>
      </div>
    )
  }

  // Dark footer: name left, date right
  const DarkFooter = ({ padH = 48 }: { padH?: number }) => (
    <div style={{
      flexShrink: 0, padding: `18px ${padH}px`, background: D.bg,
      borderTop: `1px solid ${D.dimMint20}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 13, color: D.gray, fontStyle: 'italic' }}>
        {displayName ? `— ${displayName}` : ''}
      </span>
      <span style={{ fontSize: 13, color: D.gray, fontWeight: 500 }}>{cardDate}</span>
    </div>
  )

  // ── Card layouts ─────────────────────────────────────────────────────
  let cardInner: React.ReactNode

  if (format === '9:16') {
    // ── Passport / boarding-pass style ──────────────────────────────
    const mapH916 = Math.round(h * 0.45) // ~864px

    // Ticker bar: repeating text strip
    const Ticker = (
      <div style={{
        width: w, height: 60, background: D.ticker, flexShrink: 0,
        display: 'flex', alignItems: 'center', overflow: 'hidden',
      }}>
        <div style={{
          fontSize: 22, fontWeight: 900, color: D.tickerTxt,
          textTransform: 'uppercase', letterSpacing: '3px',
          whiteSpace: 'nowrap', paddingLeft: 24,
        }}>
          {TICKER_CHUNK.repeat(8)}
        </div>
      </div>
    )

    // Flags row with mint separators (only if there are visited countries)
    const FlagsRow = flagList.length > 0 ? (
      <div style={{ flexShrink: 0, background: D.bg }}>
        <div style={{ height: 1, background: D.dimMint30 }} />
        <div style={{
          padding: '22px 32px',
          display: 'flex', flexWrap: 'wrap',
          justifyContent: 'center', alignContent: 'center',
          gap: 6,
        }}>
          {flagList.map((flag, i) => (
            <span key={i} style={{ fontSize: 30, lineHeight: 1 }}>{flag}</span>
          ))}
        </div>
        <div style={{ height: 1, background: D.dimMint30 }} />
      </div>
    ) : null

    // 2×2 stats grid
    const StatCell = ({ label, value }: { label: string; value: number }) => (
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 11, color: D.mint, fontWeight: 700,
          textTransform: 'uppercase' as const, letterSpacing: '3px', marginBottom: 14,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 72, fontWeight: 900, color: D.white,
          lineHeight: 1, letterSpacing: '-0.04em',
        }}>
          {value}
        </div>
      </div>
    )

    const StatsGrid = (
      <div style={{ flexShrink: 0, padding: '40px 48px', background: D.bg }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <StatCell label={str.countries} value={uniqueCountries} />
          <div style={{ width: 1, background: D.dimMint20, alignSelf: 'stretch', margin: '0 24px' }} />
          <StatCell label={str.days} value={totalDays} />
        </div>
        {/* Horizontal rule */}
        <div style={{ height: 1, background: D.dimMint20, margin: '28px 0' }} />
        {/* Row 2 */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <StatCell label={str.trips} value={trips.length} />
          <div style={{ width: 1, background: D.dimMint20, alignSelf: 'stretch', margin: '0 24px' }} />
          <StatCell label={str.year} value={currentYear} />
        </div>
      </div>
    )

    // Passport machine-readable line
    const mrz = displayName
      ? `VISATO<<<${displayName.toUpperCase().replace(/\s+/g, '<')}<<<<<<<<<<<<VISATO.APP<<`
      : `VISATO<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<VISATO.APP<<`

    const UserBranding = (
      <div style={{
        flex: 1, background: D.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 48px',
        borderTop: `1px solid ${D.dimMint20}`,
      }}>
        {displayName && (
          <div style={{
            fontSize: 22, color: D.white, fontWeight: 500,
            marginBottom: 16, textAlign: 'center',
          }}>
            {displayName}
          </div>
        )}
        <div style={{
          fontSize: 14, color: D.mint, fontFamily: '"Courier New", Courier, monospace',
          opacity: 0.6, letterSpacing: '1px', textAlign: 'center',
          maxWidth: w - 96, overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          {mrz.slice(0, 48)}
        </div>
        <div style={{
          marginTop: 28, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>🌍</span>
          <span style={{
            fontSize: 20, fontWeight: 900, color: D.white, letterSpacing: '-0.02em',
          }}>
            Visato
          </span>
        </div>
      </div>
    )

    cardInner = (
      <>
        {Ticker}
        <DarkHeader padH={48} logoSize={22} />
        <DarkMap mapH={mapH916} scale={185} />
        {FlagsRow}
        {StatsGrid}
        {UserBranding}
      </>
    )

  } else if (format === '16:9') {
    const mapW16 = Math.round(w * 0.62) // ~744px — map left panel
    const mapH16 = h                     // full height

    cardInner = (
      <div style={{ display: 'flex', height: h, background: D.bg }}>
        {/* Left: Map */}
        <DarkMap mapW={mapW16} mapH={mapH16} scale={130} />
        {/* Right: header + stats + footer stacked */}
        <div style={{
          flex: 1, background: D.bg,
          display: 'flex', flexDirection: 'column',
          borderLeft: `1px solid ${D.dimMint20}`,
        }}>
          <DarkHeader padH={36} logoSize={18} />
          <div style={{ height: 1, background: D.dimMint20 }} />
          {/* Stats stacked vertically */}
          <div style={{
            flex: 1, padding: '28px 36px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22,
          }}>
            {[
              { n: uniqueCountries, label: str.countries },
              { n: totalDays,       label: str.days      },
              { n: trips.length,    label: str.trips     },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, color: D.mint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 48, fontWeight: 900, color: D.white, lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {item.n}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: D.dimMint20 }} />
          <div style={{ padding: '16px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: D.gray, fontStyle: 'italic' }}>
              {displayName ? `— ${displayName}` : ''}
            </span>
            <span style={{ fontSize: 12, color: D.gray }}>{cardDate}</span>
          </div>
        </div>
      </div>
    )

  } else if (format === '1:1') {
    const mapH11 = Math.round(h * 0.52) // ~562px

    cardInner = (
      <>
        <DarkHeader />
        <div style={{ height: 1, background: D.dimMint20 }} />
        <DarkMap mapH={mapH11} scale={155} />
        <DarkStatRow numSize={46} padV={28} padH={52} gap={44} />
        <DarkFooter />
      </>
    )

  } else {
    // 4:5
    const mapH45 = Math.round(h * 0.50) // ~675px

    cardInner = (
      <>
        <DarkHeader />
        <div style={{ height: 1, background: D.dimMint20 }} />
        <DarkMap mapH={mapH45} scale={165} />
        <DarkStatRow numSize={54} padV={40} padH={52} gap={48} />
        <DarkFooter />
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
          background: D.bg,
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
                    background: 'transparent', color: 'var(--color-text-muted)',
                    fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ← {t('share.back')}
                </button>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                  <button
                    onClick={download} disabled={stage !== 'done'}
                    style={{ ...actionBtn(stage === 'done'), border: '1.5px solid #2DBF8A', background: 'transparent', color: '#2DBF8A' }}
                  >
                    {t('share.download')}
                  </button>
                  <button
                    onClick={copy} disabled={stage !== 'done'}
                    style={{ ...actionBtn(stage === 'done'), border: 'none', background: '#2DBF8A', color: '#fff' }}
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
