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

// ── Dark card design tokens ──────────────────────────────────────────
const C = {
  bg:        '#0D1F1A',
  mapBg:     '#1A2E28',
  unvisited: '#2D3D38',
  visited:   '#2DBF8A',
  mint:      '#2DBF8A',
  white:     '#FFFFFF',
  gray:      '#9CA3AF',
  dimGray:   '#6B7280',
}

const LOCALES: Record<CardLang, string> = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' }

// Strings are independent of the app's current language
const CARD_STR: Record<CardLang, {
  headlinePre: string
  headlinePost: string
  countries: string
  trips: string
  days: string
  of195: string
}> = {
  en: {
    headlinePre:  "I've visited ",
    headlinePost: ' countries',
    countries: 'Countries',
    trips: 'Trips',
    days: 'Days abroad',
    of195: '/ 195',
  },
  uk: {
    headlinePre:  'Я відвідала ',
    headlinePost: ' країн',
    countries: 'Країни',
    trips: 'Поїздки',
    days: 'Днів за кордоном',
    of195: '/ 195',
  },
  ru: {
    headlinePre:  'Я посетила ',
    headlinePost: ' стран',
    countries: 'Страны',
    trips: 'Поездки',
    days: 'Дней за рубежом',
    of195: '/ 195',
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

  // On open: sync card language to app language, reset to settings
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
        logging: false, backgroundColor: C.bg, imageTimeout: 0,
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

  // ── Card sub-components ──────────────────────────────────────────────

  // "🌍 Visato" logotype
  const Logo = ({ size = 17 }: { size?: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
      <span style={{ fontSize: size, lineHeight: 1 }}>🌍</span>
      <span style={{ fontSize: size, fontWeight: 900, color: C.white, letterSpacing: '-0.02em' }}>
        Visato
      </span>
    </div>
  )

  // "I've visited\n47\ncountries" — number in mint on its own line
  const Headline = ({ numSize, textSize }: { numSize: number; textSize: number }) => (
    <div>
      <div style={{ fontSize: textSize, fontWeight: 700, color: C.white, lineHeight: 1.15, marginBottom: 8 }}>
        {str.headlinePre.trim()}
      </div>
      <div style={{
        fontSize: numSize, fontWeight: 900, color: C.mint,
        lineHeight: 1, letterSpacing: '-0.04em', marginBottom: 8,
      }}>
        {uniqueCountries}
      </div>
      <div style={{ fontSize: textSize, fontWeight: 700, color: C.white, lineHeight: 1.15 }}>
        {str.headlinePost.trim()}
      </div>
    </div>
  )

  // Stat item: big mint number + small gray label
  const Stat = ({ n, label, numSize = 44 }: { n: number; label: string; numSize?: number }) => (
    <div>
      <div style={{
        fontSize: numSize, fontWeight: 900, color: C.mint,
        lineHeight: 1, letterSpacing: '-0.03em',
      }}>
        {n}
      </div>
      <div style={{
        fontSize: 11, color: C.gray, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '2px', marginTop: 7,
      }}>
        {label}
      </div>
    </div>
  )

  // World map in dark theme
  const CardMap = ({ mapH, mapW = w, mapScale = 175 }: { mapH: number; mapW?: number; mapScale?: number }) => (
    <div style={{ width: mapW, height: mapH, background: C.mapBg, flexShrink: 0, overflow: 'hidden' }}>
      <ComposableMap
        width={mapW} height={mapH}
        projectionConfig={{ scale: mapScale, center: [10, 8] }}
        style={{ display: 'block', width: '100%', height: '100%', background: C.mapBg }}
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
                    fill={isVisited ? C.visited : C.unvisited}
                    stroke={C.mapBg} strokeWidth={0.6}
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

  // ── Card layouts ─────────────────────────────────────────────────────
  let cardInner: React.ReactNode

  if (format === '9:16') {
    // 1080×1920 — Stories
    // Top ~348px | Map 1150px | Bottom flex:1 (~422px)
    cardInner = (
      <>
        {/* Top: logo + headline */}
        <div style={{
          flexShrink: 0,
          padding: '60px 60px 48px',
          display: 'flex', flexDirection: 'column',
        }}>
          <Logo size={18} />
          <div style={{ marginTop: 40 }}>
            <Headline numSize={80} textSize={36} />
          </div>
        </div>

        {/* Map — full card width, no side padding */}
        <CardMap mapH={1150} mapScale={185} />

        {/* Bottom: stats + date/logo */}
        <div style={{
          flex: 1,
          padding: '44px 60px 60px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {/* Two key stats */}
          <div style={{ display: 'flex', gap: 52 }}>
            {/* Countries with /195 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{
                  fontSize: 52, fontWeight: 900, color: C.mint,
                  lineHeight: 1, letterSpacing: '-0.03em',
                }}>
                  {uniqueCountries}
                </span>
                <span style={{ fontSize: 16, color: C.gray, fontWeight: 600 }}>
                  {str.of195}
                </span>
              </div>
              <div style={{
                fontSize: 11, color: C.gray, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '2px', marginTop: 7,
              }}>
                {str.countries}
              </div>
            </div>

            {/* Days abroad */}
            <div>
              <div style={{
                fontSize: 52, fontWeight: 900, color: C.mint,
                lineHeight: 1, letterSpacing: '-0.03em',
              }}>
                {totalDays}
              </div>
              <div style={{
                fontSize: 11, color: C.gray, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '2px', marginTop: 7,
              }}>
                {str.days}
              </div>
            </div>
          </div>

          {/* Date left · logo right */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: C.dimGray, fontWeight: 500 }}>{cardDate}</span>
            <Logo size={16} />
          </div>
        </div>
      </>
    )
  } else if (format === '16:9') {
    // 1200×675 — landscape: map left 60%, stats panel right 40%
    const mapW = Math.round(w * 0.60) // 720px
    cardInner = (
      <div style={{ display: 'flex', height: h }}>
        {/* Left: Map */}
        <CardMap mapW={mapW} mapH={h} mapScale={138} />

        {/* Right: Stats panel */}
        <div style={{
          flex: 1, background: C.bg,
          padding: '48px 52px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {/* Logo top-left of panel */}
          <Logo size={17} />

          {/* Stats column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <Stat n={uniqueCountries} label={str.countries} numSize={52} />
            <Stat n={totalDays}       label={str.days}      numSize={52} />
            <Stat n={trips.length}    label={str.trips}     numSize={52} />
          </div>

          {/* Date + optional name bottom */}
          <div>
            {displayName && (
              <div style={{
                fontSize: 13, color: C.dimGray, fontStyle: 'italic', marginBottom: 8,
              }}>
                — {displayName}
              </div>
            )}
            <span style={{ fontSize: 12, color: C.dimGray, fontWeight: 500 }}>{cardDate}</span>
          </div>
        </div>
      </div>
    )
  } else if (format === '1:1') {
    // 1080×1080
    // Top ~244px | Map 600px | Bottom ~236px
    cardInner = (
      <>
        {/* Header: headline left, logo right */}
        <div style={{
          flexShrink: 0,
          padding: '56px 60px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <Headline numSize={64} textSize={28} />
          <Logo size={16} />
        </div>

        {/* Map */}
        <CardMap mapH={600} mapScale={165} />

        {/* Stats + footer */}
        <div style={{
          flex: 1,
          padding: '32px 60px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 44 }}>
            <Stat n={uniqueCountries} label={str.countries} numSize={40} />
            <Stat n={totalDays}       label={str.days}      numSize={40} />
            <Stat n={trips.length}    label={str.trips}     numSize={40} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {displayName
              ? <span style={{ fontSize: 13, color: C.dimGray, fontStyle: 'italic' }}>— {displayName}</span>
              : <span />
            }
            <span style={{ fontSize: 12, color: C.dimGray }}>{cardDate}</span>
          </div>
        </div>
      </>
    )
  } else {
    // 4:5 (1080×1350) — similar to 9:16 but shorter
    // Top ~260px | Map 750px | Bottom ~340px
    cardInner = (
      <>
        {/* Header: headline left, logo right */}
        <div style={{
          flexShrink: 0,
          padding: '56px 60px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <Headline numSize={72} textSize={32} />
          <Logo size={17} />
        </div>

        {/* Map */}
        <CardMap mapH={750} mapScale={175} />

        {/* Stats + footer */}
        <div style={{
          flex: 1,
          padding: '40px 60px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 44 }}>
            <Stat n={uniqueCountries} label={str.countries} numSize={44} />
            <Stat n={totalDays}       label={str.days}      numSize={44} />
            <Stat n={trips.length}    label={str.trips}     numSize={44} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {displayName
              ? <span style={{ fontSize: 14, color: C.dimGray, fontStyle: 'italic' }}>— {displayName}</span>
              : <span style={{ fontSize: 13, color: C.dimGray }}>{cardDate}</span>
            }
            <Logo size={16} />
          </div>
        </div>
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
          background: C.bg,
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
