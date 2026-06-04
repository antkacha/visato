import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import html2canvas from 'html2canvas'
import type { User } from '@supabase/supabase-js'
import type { TripEntry } from '../../types'
import { ISO_TO_SLUG } from '../../constants/countryIsoMap'
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

type Stage = 'idle' | 'generating' | 'done' | 'error'

export default function ShareModal({ isOpen, onClose, trips, topoData, user }: Props) {
  const { t } = useTranslation()
  const cardRef  = useRef<HTMLDivElement>(null)
  const [stage, setStage]   = useState<Stage>('idle')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [blob,   setBlob]   = useState<Blob | null>(null)
  const [copied, setCopied] = useState(false)

  const visitedSlugs   = useMemo(() => new Set(trips.map((t) => t.country)), [trips])
  const uniqueCountries = useMemo(() => visitedSlugs.size, [visitedSlugs])
  const totalDays      = useMemo(() => trips.reduce((s, t) => s + tripDays(t), 0), [trips])
  const displayName    = user?.user_metadata?.full_name as string | undefined

  // Capture the hidden share card when the modal opens
  useEffect(() => {
    if (!isOpen || !topoData) return
    setStage('generating')
    setDataUrl(null)
    setBlob(null)

    const timer = setTimeout(async () => {
      if (!cardRef.current) { setStage('error'); return }
      try {
        const canvas = await html2canvas(cardRef.current, {
          width: 1200,
          height: 630,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 0,
        })
        const url = canvas.toDataURL('image/png')
        const b = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((x) => (x ? res(x) : rej(new Error('toBlob'))), 'image/png'),
        )
        setDataUrl(url)
        setBlob(b)
        setStage('done')
      } catch (err) {
        console.error('[share]', err)
        setStage('error')
      }
    }, 700) // give react-simple-maps time to render SVG paths

    return () => clearTimeout(timer)
  }, [isOpen, topoData])

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) { setStage('idle'); setDataUrl(null); setBlob(null) }
  }, [isOpen])

  const download = useCallback(() => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.download = 'visato-map.png'
    a.href = dataUrl
    a.click()
  }, [dataUrl])

  const copy = useCallback(async () => {
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[share] clipboard write failed', err)
    }
  }, [blob])

  if (!isOpen) return null

  const btnBase: React.CSSProperties = {
    padding: '0.5rem 1.125rem',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: stage === 'done' ? 'pointer' : 'not-allowed',
    opacity: stage === 'done' ? 1 : 0.45,
    fontFamily: 'Inter, system-ui, sans-serif',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s ease',
  }

  return (
    <>
      {/* ── Hidden share card — captured by html2canvas ──────────────── */}
      <div
        ref={cardRef}
        style={{
          position: 'fixed', left: -9999, top: -9999,
          width: 1200, height: 630,
          background: '#FFFFFF',
          fontFamily: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Logo bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '26px 64px 18px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>🌍</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#2DBF8A', letterSpacing: '-0.02em' }}>
              Visato
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>
            visato.app
          </span>
        </div>

        {/* World map — fills remaining space */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#EAF4FF', position: 'relative' }}>
          <ComposableMap
            width={1200}
            height={420}
            projectionConfig={{ scale: 175, center: [10, 8] }}
            style={{ display: 'block', width: '100%', height: '100%', background: '#EAF4FF' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({} as any)}
          >
            <Geographies geography={topoData as Record<string, unknown>}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => String(geo.id) !== '10') // Antarctica
                  .map((geo) => {
                    const slug = ISO_TO_SLUG[Number(geo.id)]
                    const isVisited = !!slug && visitedSlugs.has(slug)
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isVisited ? '#2DBF8A' : '#C8DDEE'}
                        stroke="#FFFFFF"
                        strokeWidth={0.5}
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

        {/* Stats footer */}
        <div style={{
          flexShrink: 0,
          padding: '20px 64px 26px',
          background: '#F8FAFC',
          borderTop: '1px solid #EDEFF2',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          {/* Stat tiles */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 56 }}>
            {[
              { n: uniqueCountries, label: 'Countries' },
              { n: trips.length,    label: 'Trips' },
              { n: totalDays,       label: 'Days abroad' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 38, fontWeight: 900, color: '#2DBF8A',
                  lineHeight: 1, letterSpacing: '-0.03em',
                }}>
                  {s.n}
                </div>
                <div style={{
                  fontSize: 10, color: '#9CA3AF', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.09em', marginTop: 3,
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* User name */}
          {displayName && (
            <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
              — {displayName}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal overlay ────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
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
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1.125rem',
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

          {/* Preview area — 1200:630 aspect ratio */}
          <div style={{
            width: '100%', aspectRatio: '1200 / 630',
            borderRadius: '0.625rem', overflow: 'hidden',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.125rem',
          }}>
            {stage === 'generating' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
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
            {stage === 'done' && dataUrl && (
              <img
                src={dataUrl}
                alt="Share card preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
            {stage === 'error' && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                Could not generate image
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
            <button
              onClick={download}
              disabled={stage !== 'done'}
              style={{
                ...btnBase,
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
                ...btnBase,
                border: 'none',
                background: '#2DBF8A',
                color: '#fff',
              }}
            >
              {copied ? t('share.copied') : t('share.copy')}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}
