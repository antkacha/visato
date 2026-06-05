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

// Card-text strings independent of app i18n language
const CARD_STR: Record<CardLang, { countries: string; trips: string; days: string; tagline: string }> = {
  en: { countries: 'Countries', trips: 'Trips', days: 'Days abroad',       tagline: 'My travel map'         },
  uk: { countries: 'Країни',    trips: 'Поїздки', days: 'Днів за кордоном', tagline: 'Моя карта подорожей'  },
  ru: { countries: 'Страны',    trips: 'Поездки', days: 'Дней за рубежом',  tagline: 'Моя карта путешествий' },
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

  // On open: sync card language to current app language, reset to settings stage
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
    // Give React + react-simple-maps SVG time to fully paint at the selected format
    await new Promise(r => setTimeout(r, 800))
    const { w, h } = FORMATS[format]
    try {
      const canvas = await html2canvas(cardRef.current, {
        width: w, height: h, scale: 1,
        useCORS: true, allowTaint: true,
        logging: false, backgroundColor: '#ffffff', imageTimeout: 0,
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
  const str   = CARD_STR[cardLang]
  const stats = [
    { n: uniqueCountries, label: str.countries },
    { n: trips.length,    label: str.trips     },
    { n: totalDays,       label: str.days      },
  ]

  // ── Shared style helpers ─────────────────────────────────────────────
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

  // ── Off-screen card sub-components ──────────────────────────────────
  const CardLogo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>🌍</span>
      <span style={{ fontSize: 18, fontWeight: 900, color: '#2DBF8A', letterSpacing: '-0.02em' }}>Visato</span>
    </div>
  )

  const CardMap = ({ mapH, mapScale = 175 }: { mapH: number; mapScale?: number }) => (
    <div style={{ width: w, height: mapH, background: '#EAF4FF', flexShrink: 0, overflow: 'hidden' }}>
      <ComposableMap
        width={w} height={mapH}
        projectionConfig={{ scale: mapScale, center: [10, 8] }}
        style={{ display: 'block', width: '100%', height: '100%', background: '#EAF4FF' }}
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
                    fill={isVisited ? '#2DBF8A' : '#C8DDEE'}
                    stroke="#FFFFFF" strokeWidth={0.5}
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

  const CardStatRow = ({ numSize, lblSize, gap }: { numSize: number; lblSize: number; gap: number }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap, justifyContent: 'center' }}>
      {stats.map((s, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: numSize, fontWeight: 900, color: '#2DBF8A',
            lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 7,
          }}>
            {s.n}
          </div>
          <div style={{
            fontSize: lblSize, color: '#6B7280', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '1.8px',
          }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )

  // ── Card inner layout (switches on format) ───────────────────────────
  let cardInner: React.ReactNode

  if (format === '16:9') {
    // 1200×675 — map big, compact stats footer
    cardInner = (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 56px 14px', flexShrink: 0,
        }}>
          <CardLogo />
          <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>visato.app</span>
        </div>
        <CardMap mapH={490} />
        <div style={{
          flex: 1, padding: '0 56px', background: '#F8FAFC',
          borderTop: '1px solid #EDEFF2',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <CardStatRow numSize={40} lblSize={10} gap={68} />
          {displayName && (
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginTop: 10 }}>
              — {displayName}
            </div>
          )}
        </div>
      </>
    )
  } else if (format === '1:1') {
    // 1080×1080 — balanced split
    cardInner = (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '28px 64px 18px', flexShrink: 0,
        }}>
          <CardLogo />
          <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>visato.app</span>
        </div>
        <CardMap mapH={580} />
        <div style={{
          flex: 1, padding: '0 64px', background: '#F8FAFC',
          borderTop: '1px solid #EDEFF2',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <CardStatRow numSize={58} lblSize={12} gap={76} />
          {displayName && (
            <div style={{ fontSize: 17, color: '#374151', fontWeight: 500, marginTop: 18 }}>
              — {displayName}
            </div>
          )}
        </div>
      </>
    )
  } else if (format === '4:5') {
    // 1080×1350 — map top half, large stats bottom half
    cardInner = (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '32px 64px 20px', flexShrink: 0,
        }}>
          <CardLogo />
          <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>visato.app</span>
        </div>
        <CardMap mapH={740} />
        <div style={{
          flex: 1, padding: '0 64px', background: '#F8FAFC',
          borderTop: '1px solid #EDEFF2',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <CardStatRow numSize={70} lblSize={13} gap={84} />
          {displayName && (
            <div style={{ fontSize: 20, color: '#374151', fontWeight: 500, marginTop: 22 }}>
              — {displayName}
            </div>
          )}
        </div>
      </>
    )
  } else {
    // 9:16 (1080×1920) — portrait: large stats above map, branding below
    cardInner = (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '52px 72px 28px', flexShrink: 0,
        }}>
          <CardLogo />
          <span style={{ fontSize: 14, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>visato.app</span>
        </div>
        {/* Stats hero — above the map */}
        <div style={{
          flexShrink: 0, padding: '0 72px 52px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            fontSize: 13, color: '#9CA3AF', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '4px', marginBottom: 28,
          }}>
            {str.tagline}
          </div>
          <CardStatRow numSize={84} lblSize={14} gap={56} />
        </div>
        <CardMap mapH={1200} mapScale={200} />
        {/* Footer */}
        <div style={{
          flex: 1, background: '#F8FAFC',
          borderTop: '1px solid #EDEFF2',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '0 72px',
        }}>
          {displayName && (
            <div style={{ fontSize: 22, color: '#374151', fontWeight: 500, marginBottom: 14 }}>
              — {displayName}
            </div>
          )}
          <div style={{ fontSize: 16, color: '#2DBF8A', fontWeight: 700, letterSpacing: '0.05em' }}>
            visato.app
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
      {/* ── Off-screen share card — always rendered so SVG paths load ── */}
      <div
        ref={cardRef}
        style={{
          position: 'fixed', left: -9999, top: -9999,
          width: w, height: h,
          background: '#FFFFFF',
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

          {/* ── Settings stage ────────────────────────────────────────── */}
          {stage === 'settings' && (
            <div>
              {/* Format selector */}
              <div style={{ marginBottom: '1.125rem' }}>
                <div style={sectionLabel}>{t('share.format')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FORMAT_KEYS.map(f => (
                    <button key={f} onClick={() => setFormat(f)} style={pillStyle(format === f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language selector */}
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

              {/* Generate button */}
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

          {/* ── Generating spinner ────────────────────────────────────── */}
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

          {/* ── Done / Error: preview + actions ──────────────────────── */}
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
                {/* Back to settings */}
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
