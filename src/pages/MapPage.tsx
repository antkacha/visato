import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { AnimatePresence, motion } from 'framer-motion'
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
  id: string | number  // world-atlas stores IDs as strings in JSON
  properties: Record<string, unknown>
  geometry: unknown
}

type ViewMode = 'globe' | 'flat'

// Monochrome gray globe with mint highlights
const THEME = {
  dark: {
    bg: '#0c1424',
    ocean: '#9BA8B0',
    visited: '#2DBF8A',
    unvisited: '#C8D0D6',
    statBg: 'rgba(13,20,36,0.85)',
  },
  light: {
    bg: '#F0FAF6',
    ocean: '#9BA8B0',
    visited: '#2DBF8A',
    unvisited: '#C8D0D6',
    statBg: 'rgba(255,255,255,0.92)',
  },
}

const TOGGLE_H = 50
const MAP_MIN_ZOOM = 1
const MAP_MAX_ZOOM = 20

const viewVariants = {
  globeInitial: { opacity: 0, scale: 0.90 },
  globeAnimate: { opacity: 1, scale: 1 },
  globeExit:    { opacity: 0, scale: 0.90 },
  flatInitial:  { opacity: 0, scale: 0.96 },
  flatAnimate:  { opacity: 1, scale: 1 },
  flatExit:     { opacity: 0, scale: 0.96 },
}

const panelTransition = { duration: 0.4, ease: 'easeInOut' as const }

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
  const [topoData, setTopoData] = useState<unknown>(null)
  const [, setHovered] = useState<GeoFeature | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('globe')
  const [flatTooltip, setFlatTooltip] = useState<{ x: number; y: number; slug: string } | null>(null)

  // 2D map zoom/pan state — default centered on Europe
  const [mapZoom, setMapZoom] = useState(1)
  const [mapCenter, setMapCenter] = useState<[number, number]>([15, 50])
  const [isDragging, setIsDragging] = useState(false)

  // Solid-color canvas texture for the ocean — the only reliable way to override
  // three-globe's built-in satellite texture without leaving black squares.
  const [oceanDataUrl, setOceanDataUrl] = useState('')
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = colors.ocean
    ctx.fillRect(0, 0, 2, 1)
    setOceanDataUrl(canvas.toDataURL('image/png'))
  }, [colors.ocean])

  // Load world atlas — GeoJSON features for Globe, raw TopoJSON for react-simple-maps
  useEffect(() => {
    import('world-atlas/countries-110m.json').then((mod) => {
      const topo = mod.default as unknown as Topology<{ countries: GeometryCollection }>
      const geo = feature(topo, topo.objects.countries)
      setCountries((geo as unknown as { features: GeoFeature[] }).features)
      setTopoData(mod.default)
    })
  }, [])

  // Track container size
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

  const applyGlobeMaterial = useCallback((g: any) => {
    try {
      const mat = g.globeMaterial()
      mat.map = null
      mat.color.set(colors.ocean)
      mat.emissive.set(colors.ocean)
      mat.emissiveIntensity = 1
      mat.needsUpdate = true
    } catch (_) { /* ignore */ }

    try {
      const scene = g.scene()
      scene.children
        .filter((c: any) => c.type === 'DirectionalLight')
        .forEach((c: any) => scene.remove(c))
      const sphereMesh = scene.children.find((c: any) => c.isMesh)
      if (sphereMesh) {
        const mat = sphereMesh.material
        mat.map = null
        mat.color.set(colors.ocean)
        mat.emissive.set(colors.ocean)
        mat.emissiveIntensity = 1
        mat.needsUpdate = true
      }
    } catch (_) { /* ignore */ }
  }, [colors.ocean])

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
      timer = setTimeout(() => { ctrl.autoRotate = true }, 2000)
    })
  }, [applyGlobeMaterial])

  useEffect(() => {
    const globe = globeRef.current
    if (globe) applyGlobeMaterial(globe as any)
  }, [applyGlobeMaterial])

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

  const renderFlatTooltip = () => {
    if (!flatTooltip || isDragging) return null
    const { x, y, slug } = flatTooltip
    const name = t(`countries.${slug}`, { defaultValue: slug })
    const flag = COUNTRY_FLAGS[slug] ?? ''
    const stats = countryStats[slug]
    const isVisited = !!stats
    const cardBg = theme === 'dark' ? 'rgba(13,22,38,0.96)' : '#ffffff'
    const textColor = theme === 'dark' ? '#ffffff' : '#1a1a1a'
    const subColor = theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'
    const borderColor = isVisited ? '#2DBF8A' : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
    return (
      <div style={{
        position: 'fixed', left: x + 14, top: y - 40, zIndex: 200,
        pointerEvents: 'none', background: cardBg, color: textColor,
        padding: '8px 12px', borderRadius: '8px',
        fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600,
        whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        border: `1px solid ${borderColor}`,
      }}>
        {flag} {name}
        {isVisited && (
          <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 400, color: subColor }}>
            {stats.trips} trip{stats.trips !== 1 ? 's' : ''} · {stats.days} day{stats.days !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    )
  }

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

  // Zoom button style shared between + and −
  const zoomBtnStyle: React.CSSProperties = {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    border: 'none',
    background: theme === 'dark' ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.92)',
    color: theme === 'dark' ? '#ffffff' : '#374151',
    fontSize: '20px',
    lineHeight: '1',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 400,
    userSelect: 'none',
    WebkitUserSelect: 'none',
  }

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
          {(['globe', 'flat'] as ViewMode[]).map((mode) => {
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

      {/* Map area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <AnimatePresence>
          {/* ── 3D Globe ───────────────────────────────────────────── */}
          {viewMode === 'globe' && (
            <motion.div
              key="globe"
              initial={viewVariants.globeInitial}
              animate={viewVariants.globeAnimate}
              exit={viewVariants.globeExit}
              transition={panelTransition}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
            >
              {countries.length > 0 ? (
                <div style={{ filter: 'drop-shadow(0px 30px 60px rgba(0,0,0,0.25))' }}>
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
                    polygonStrokeColor={() => '#FFFFFF'}
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
            </motion.div>
          )}

          {/* ── 2D Flat map ────────────────────────────────────────── */}
          {viewMode === 'flat' && (
            <motion.div
              key="flat"
              initial={viewVariants.flatInitial}
              animate={viewVariants.flatAnimate}
              exit={viewVariants.flatExit}
              transition={panelTransition}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
            >
              {topoData ? (
                <ComposableMap
                  projection="geoNaturalEarth1"
                  projectionConfig={{ scale: 400 }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <ZoomableGroup
                    zoom={mapZoom}
                    center={mapCenter}
                    minZoom={MAP_MIN_ZOOM}
                    maxZoom={MAP_MAX_ZOOM}
                    onMove={() => { setIsDragging(true); setFlatTooltip(null) }}
                    onMoveEnd={({ coordinates, zoom }) => {
                      setMapCenter(coordinates)
                      setMapZoom(zoom)
                      setIsDragging(false)
                    }}
                  >
                    <Geographies geography={topoData}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const slug = ISO_TO_SLUG[Number(geo.id)]
                          const isVisited = !!slug && visitedSlugs.has(slug)
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={isVisited ? '#2DBF8A' : colors.unvisited}
                              stroke="#FFFFFF"
                              strokeWidth={0.3 / mapZoom}
                              onMouseEnter={(e) => {
                                if (!slug || isDragging) return
                                setFlatTooltip({ x: e.clientX, y: e.clientY, slug })
                              }}
                              onMouseMove={(e) => {
                                if (!slug || isDragging) return
                                setFlatTooltip({ x: e.clientX, y: e.clientY, slug })
                              }}
                              onMouseLeave={() => setFlatTooltip(null)}
                              style={{
                                default: { outline: 'none' },
                                hover: {
                                  fill: isVisited ? '#25A876' : '#B5BEC5',
                                  outline: 'none',
                                  cursor: isDragging ? 'grabbing' : 'pointer',
                                },
                                pressed: { outline: 'none', cursor: 'grabbing' },
                              }}
                            />
                          )
                        })
                      }
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>
              ) : (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                  fontSize: '0.875rem',
                }}>
                  Loading map…
                </div>
              )}

              {/* Zoom controls */}
              {!!topoData && (
                <div style={{
                  position: 'absolute', bottom: '16px', right: '16px',
                  display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 10,
                }}>
                  <button
                    style={zoomBtnStyle}
                    onClick={() => setMapZoom(z => Math.min(z * 2, MAP_MAX_ZOOM))}
                    title="Zoom in"
                  >
                    +
                  </button>
                  <button
                    style={zoomBtnStyle}
                    onClick={() => setMapZoom(z => Math.max(z / 2, MAP_MIN_ZOOM))}
                    title="Zoom out"
                  >
                    −
                  </button>
                </div>
              )}

              {trips.length === 0 && !!topoData && (
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
              {renderFlatTooltip()}
            </motion.div>
          )}
        </AnimatePresence>
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
