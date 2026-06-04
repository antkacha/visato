import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import { motion } from 'framer-motion'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'
import type { TripEntry } from '../types'
import { COUNTRY_FLAGS } from '../constants/countries'
import { ISO_TO_SLUG } from '../constants/countryIsoMap'
import { differenceInDays, parseISO } from 'date-fns'
import { today } from '../utils/dateUtils'

interface Props {
  trips: TripEntry[]
}

interface GeoFeature {
  type: string
  id: string | number
  properties: Record<string, unknown>
  geometry: unknown
}

type ViewMode = 'globe' | 'map'

// Pearl/porcelain globe palette — same for both themes
const OCEAN_COLOR    = '#B8CCE0'   // soft pastel blue-white
const OCEAN_EMISSIVE = '#8AAEC6'   // slightly deeper for shadow-side glow
const GLOBE_SHADOW   = 'drop-shadow(0px 25px 50px rgba(100,140,180,0.4))'

const THEME = {
  dark: {
    bg: '#0c1424',
    visited: '#2DBF8A',
    unvisited: '#DDEAF5',
    statBg: 'rgba(13,20,36,0.85)',
  },
  light: {
    bg: '#F0FAF6',
    visited: '#2DBF8A',
    unvisited: '#DDEAF5',
    statBg: 'rgba(255,255,255,0.92)',
  },
}

const TOGGLE_H = 50

function tripDays(trip: TripEntry): number {
  const exit = trip.exitDate === 'ongoing' ? today() : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

export default function MapPage({ trips }: Props) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const colors = THEME[theme]

  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [countries, setCountries] = useState<GeoFeature[]>([])
  const [, setHovered] = useState<GeoFeature | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('globe')

  // Static 1x1 canvas in ocean color — prevents three-globe from loading
  // its default satellite texture before applyGlobeMaterial fires.
  const [oceanDataUrl, setOceanDataUrl] = useState('')
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2; canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = OCEAN_COLOR
    ctx.fillRect(0, 0, 2, 1)
    setOceanDataUrl(canvas.toDataURL('image/png'))
  }, [])

  // Load world atlas GeoJSON for the Globe polygons
  useEffect(() => {
    import('world-atlas/countries-110m.json').then((mod) => {
      const topo = mod.default as unknown as Topology<{ countries: GeometryCollection }>
      const geo = feature(topo, topo.objects.countries)
      setCountries((geo as unknown as { features: GeoFeature[] }).features)
    })
  }, [])

  // Track container size for explicit Globe width/height
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setDims({ w: el.offsetWidth, h: el.offsetHeight })
    })
    ro.observe(el)
    setDims({ w: el.offsetWidth, h: el.offsetHeight })
    return () => ro.disconnect()
  }, [])

  // Pearl globe material:
  //   mat.color     = base color (lit side)
  //   mat.emissive  = self-glow color (shadow side)
  //   emissiveIntensity 0.5 + softened DirectionalLight → natural spherical shading
  const applyGlobeMaterial = useCallback((g: any) => {
    const applyMat = (mat: any) => {
      mat.map = null
      mat.color.set(OCEAN_COLOR)
      mat.emissive.set(OCEAN_EMISSIVE)
      mat.emissiveIntensity = 0.5
      mat.needsUpdate = true
    }
    try { applyMat(g.globeMaterial()) } catch (_) { /* ignore */ }
    try {
      const scene = g.scene()
      // Soften (not remove) DirectionalLights so they contribute gentle shading
      scene.children
        .filter((c: any) => c.type === 'DirectionalLight')
        .forEach((c: any) => { c.intensity = 0.35 })
      const sphereMesh = scene.children.find((c: any) => c.isMesh)
      if (sphereMesh) applyMat(sphereMesh.material)
    } catch (_) { /* ignore */ }
  }, [])

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return
    const g = globe as any

    applyGlobeMaterial(g)
    setTimeout(() => applyGlobeMaterial(g), 100)
    setTimeout(() => applyGlobeMaterial(g), 500)

    try {
      g.scene().background = null
      g.renderer().setClearColor(0x000000, 0)
    } catch (_) { /* ignore */ }

    const ctrl = g.controls()
    ctrl.autoRotate = true
    ctrl.autoRotateSpeed = 0.4
    let timer: ReturnType<typeof setTimeout>
    ctrl.addEventListener('start', () => { ctrl.autoRotate = false; clearTimeout(timer) })
    ctrl.addEventListener('end', () => {
      // Only restore auto-rotation in globe mode
      if (viewMode === 'globe') {
        timer = setTimeout(() => { ctrl.autoRotate = true }, 2000)
      }
    })
  }, [applyGlobeMaterial, viewMode])

  useEffect(() => {
    const globe = globeRef.current
    if (globe) applyGlobeMaterial(globe as any)
  }, [applyGlobeMaterial])

  // When the user switches views, fly the camera to the right position
  useEffect(() => {
    const g = globeRef.current as any
    if (!g) return
    try {
      const ctrl = g.controls()
      if (!ctrl) return
      if (viewMode === 'map') {
        ctrl.autoRotate = false
        // Fly to Europe, close enough to see individual countries
        g.pointOfView({ lat: 52, lng: 14, altitude: 1.3 }, 1200)
      } else {
        ctrl.autoRotate = true
        g.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1000)
      }
    } catch (_) { /* ignore */ }
  }, [viewMode])

  const visitedSlugs = useMemo(
    () => new Set(trips.map((t) => t.country)),
    [trips]
  )

  const countryStats = useMemo(() => {
    const stats: Record<string, { trips: number; days: number }> = {}
    for (const t of trips) {
      if (!stats[t.country]) stats[t.country] = { trips: 0, days: 0 }
      stats[t.country].trips += 1
      stats[t.country].days += tripDays(t)
    }
    return stats
  }, [trips])

  useEffect(() => {
    if (!countries.length || !trips.length) return
    console.log('[Map] Trip country slugs:', [...visitedSlugs])
    const visited = countries
      .map((f) => ({ id: String(f.id), slug: ISO_TO_SLUG[Number(f.id)] }))
      .filter(({ slug }) => slug && visitedSlugs.has(slug))
    console.log('[Map] Matched GeoJSON features for visited countries:', visited)
  }, [countries, trips.length, visitedSlugs])

  const getCapColor = useCallback(
    (f: object) => {
      const feat = f as GeoFeature
      const slug = ISO_TO_SLUG[Number(feat.id)]
      return visitedSlugs.has(slug) ? colors.visited : colors.unvisited
    },
    [visitedSlugs, colors]
  )

  const getLabel = useCallback(
    (f: object) => {
      const feat = f as GeoFeature
      const slug = ISO_TO_SLUG[Number(feat.id)]
      if (!slug) return ''
      const name = t(`countries.${slug}`, { defaultValue: slug })
      const flag = COUNTRY_FLAGS[slug] ?? ''
      const stats = countryStats[slug]
      const isVisited = !!stats
      const cardBg = theme === 'dark' ? 'rgba(13,22,38,0.96)' : '#ffffff'
      const textColor = theme === 'dark' ? '#ffffff' : '#1a1a1a'
      const subColor = theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'
      const borderColor = isVisited ? '#2DBF8A' : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
      return `<div style="background:${cardBg};color:${textColor};padding:8px 12px;border-radius:8px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;pointer-events:none;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.25);border:1px solid ${borderColor};">${flag} ${name}${isVisited ? `<div style="margin-top:4px;font-size:11px;font-weight:400;color:${subColor}">${stats.trips} trip${stats.trips !== 1 ? 's' : ''} · ${stats.days} day${stats.days !== 1 ? 's' : ''}</div>` : ''}</div>`
    },
    [t, countryStats, theme]
  )

  // ── Stats ──────────────────────────────────────────────────────────────
  const uniqueCountries = useMemo(
    () => [...new Set(trips.map((t) => t.country))],
    [trips]
  )

  const totalDays = useMemo(
    () => trips.reduce((sum, t) => sum + tripDays(t), 0),
    [trips]
  )

  const topCountry = useMemo(() => {
    if (trips.length === 0) return null
    const daysByCountry: Record<string, number> = {}
    for (const t of trips) {
      daysByCountry[t.country] = (daysByCountry[t.country] ?? 0) + tripDays(t)
    }
    return Object.entries(daysByCountry).sort(([, a], [, b]) => b - a)[0]
  }, [trips])

  const statsItems = [
    { label: t('map.totalCountries'), value: uniqueCountries.length },
    { label: t('map.totalDays'), value: totalDays },
    {
      label: t('map.topCountry'),
      value: topCountry
        ? `${COUNTRY_FLAGS[topCountry[0]] ?? ''} ${t(`countries.${topCountry[0]}`, { defaultValue: topCountry[0] })}`
        : '—',
    },
  ]

  const globeH = Math.max(dims.h - 120 - TOGGLE_H, 200)
  const toggleBg = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const inactiveColor = theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'

  return (
    <div
      ref={containerRef}
      style={{
        height: 'calc(100dvh - 56px)',
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* View toggle */}
      <div style={{
        height: `${TOGGLE_H}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: '0 1rem',
      }}>
        <div style={{
          display: 'inline-flex',
          background: toggleBg,
          borderRadius: '999px',
          padding: '3px',
          gap: '2px',
        }}>
          {(['globe', 'map'] as ViewMode[]).map((mode) => {
            const isActive = viewMode === mode
            return (
              <motion.button
                key={mode}
                onClick={() => setViewMode(mode)}
                animate={{
                  backgroundColor: isActive ? '#2DBF8A' : 'rgba(0,0,0,0)',
                  color: isActive ? '#ffffff' : inactiveColor,
                }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  padding: '6px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                }}
              >
                {mode === 'globe' ? `🌍 ${t('map.view3d')}` : `🗺️ ${t('map.view2d')}`}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Map area — single Globe, behavior changes with viewMode */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {countries.length > 0 ? (
          <div style={{ filter: GLOBE_SHADOW }}>
            <Globe
              ref={globeRef}
              width={dims.w}
              height={globeH}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl={oceanDataUrl || (null as unknown as string)}
              showAtmosphere={false}
              polygonsData={countries}
              polygonCapColor={getCapColor}
              polygonSideColor={() => 'transparent'}
              polygonStrokeColor={() => 'rgba(255,255,255,0.8)'}
              polygonLabel={getLabel}
              onPolygonHover={(f) => setHovered(f as GeoFeature | null)}
              onGlobeReady={handleGlobeReady}
            />
          </div>
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
            fontSize: '0.875rem',
          }}>
            Loading globe…
          </div>
        )}
        {trips.length === 0 && countries.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '1rem', left: '50%',
            transform: 'translateX(-50%)',
            background: colors.statBg,
            padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.8125rem',
            color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)', border: `1px solid rgba(255,255,255,0.12)`,
            whiteSpace: 'nowrap',
          }}>
            {t('map.noTrips')}
          </div>
        )}
        {/* Hint shown in map mode */}
        {viewMode === 'map' && countries.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '1rem', right: '1rem',
            fontSize: '0.75rem',
            color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
            fontFamily: 'Inter, sans-serif',
            pointerEvents: 'none',
          }}>
            Scroll to zoom · Drag to pan
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{
        height: '120px',
        background: colors.statBg,
        backdropFilter: 'blur(12px)',
        borderTop: `1px solid rgba(255,255,255,0.08)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1px',
        padding: '0 1rem',
        flexShrink: 0,
      }}>
        {statsItems.map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem 0.5rem',
              borderRight: i < statsItems.length - 1
                ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                : 'none',
            }}
          >
            <span style={{
              fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
              fontWeight: 800,
              color: '#2DBF8A',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              fontFamily: 'Inter, system-ui, sans-serif',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {s.value}
            </span>
            <span style={{
              fontSize: 'clamp(0.6875rem, 1.5vw, 0.8125rem)',
              color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
              marginTop: '0.25rem',
              textAlign: 'center',
              fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: 1.2,
            }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
