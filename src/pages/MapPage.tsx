import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
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
  id: string | number
  properties: Record<string, unknown>
  geometry: unknown
}

type ViewMode = 'globe' | 'map'

// Pearl/porcelain globe — consistent across themes
const OCEAN_COLOR    = '#B8CCE0'
const OCEAN_EMISSIVE = '#8AAEC6'
const GLOBE_SHADOW   = 'drop-shadow(0px 25px 50px rgba(100,140,180,0.4))'

const THEME = {
  dark:  { bg: '#0c1424', visited: '#2DBF8A', unvisited: '#DDEAF5', statBg: 'rgba(13,20,36,0.85)' },
  light: { bg: '#F0FAF6', visited: '#2DBF8A', unvisited: '#DDEAF5', statBg: 'rgba(255,255,255,0.92)' },
}

const TOGGLE_H  = 50
const MIN_SCALE = 0.6
const MAX_SCALE = 15

function tripDays(trip: TripEntry): number {
  const exit = trip.exitDate === 'ongoing' ? today() : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

export default function MapPage({ trips }: Props) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const colors = THEME[theme]

  // ── Globe refs / state ──────────────────────────────────────────────
  const globeRef     = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims]       = useState({ w: 800, h: 600 })
  const [countries, setCountries] = useState<GeoFeature[]>([])
  const [topoData, setTopoData]   = useState<unknown>(null)
  const [hoveredId, setHoveredId] = useState<string | number | null>(null)
  const [viewMode, setViewMode]   = useState<ViewMode>('globe')
  const [oceanDataUrl, setOceanDataUrl] = useState('')

  // ── Flat-map state ──────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const dragRef         = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null)
  const touchRef        = useRef<{
    touches: Array<{ x: number; y: number }>
    tx: number; ty: number; scale: number; dist: number
  } | null>(null)
  const [panZoom, setPanZoom]   = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [flatTooltip, setFlatTooltip]   = useState<{ x: number; y: number; slug: string } | null>(null)
  const [globeTooltip, setGlobeTooltip] = useState<{ x: number; y: number; slug: string } | null>(null)
  const globeMouseRef    = useRef({ x: 0, y: 0 })
  const [isButtonZooming, setIsButtonZooming] = useState(false)
  const btnZoomTimer     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Ocean texture data URL (prevents three-globe default satellite image) ──
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2; canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = OCEAN_COLOR
    ctx.fillRect(0, 0, 2, 1)
    setOceanDataUrl(canvas.toDataURL('image/png'))
  }, [])

  // ── Load world atlas ────────────────────────────────────────────────
  useEffect(() => {
    import('world-atlas/countries-110m.json').then((mod) => {
      const topo = mod.default as unknown as Topology<{ countries: GeometryCollection }>
      const geo  = feature(topo, topo.objects.countries)
      setCountries((geo as unknown as { features: GeoFeature[] }).features)
      setTopoData(mod.default)
    })
  }, [])

  // ── Container resize observer ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setDims({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    setDims({ w: el.offsetWidth, h: el.offsetHeight })
    return () => ro.disconnect()
  }, [])

  // ── Globe material (pearl shading) ──────────────────────────────────
  const applyGlobeMaterial = useCallback((g: any) => {
    const applyMat = (mat: any) => {
      mat.map = null
      mat.color.set(OCEAN_COLOR)
      mat.emissive.set(OCEAN_EMISSIVE)
      mat.emissiveIntensity = 0.5
      mat.needsUpdate = true
    }
    try { applyMat(g.globeMaterial()) } catch (_) {}
    try {
      const scene = g.scene()
      scene.children
        .filter((c: any) => c.type === 'DirectionalLight')
        .forEach((c: any) => { c.intensity = 0.35 })
      const sphereMesh = scene.children.find((c: any) => c.isMesh)
      if (sphereMesh) applyMat(sphereMesh.material)
    } catch (_) {}
  }, [])

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return
    const g = globe as any
    applyGlobeMaterial(g)
    setTimeout(() => applyGlobeMaterial(g), 100)
    setTimeout(() => applyGlobeMaterial(g), 500)
    try { g.scene().background = null; g.renderer().setClearColor(0x000000, 0) } catch (_) {}
    const ctrl = g.controls()
    ctrl.autoRotate = true
    ctrl.autoRotateSpeed = 0.4
    let timer: ReturnType<typeof setTimeout>
    ctrl.addEventListener('start', () => { ctrl.autoRotate = false; clearTimeout(timer) })
    ctrl.addEventListener('end', () => {
      if (viewMode === 'globe') timer = setTimeout(() => { ctrl.autoRotate = true }, 2000)
    })
  }, [applyGlobeMaterial, viewMode])

  useEffect(() => {
    const globe = globeRef.current
    if (globe) applyGlobeMaterial(globe as any)
  }, [applyGlobeMaterial])

  // Stop/start globe rotation when view mode changes
  useEffect(() => {
    const g = globeRef.current as any
    if (!g) return
    try {
      const ctrl = g.controls()
      if (ctrl) ctrl.autoRotate = viewMode === 'globe'
    } catch (_) {}
  }, [viewMode])

  // ── Flat-map non-passive events (wheel + touch) ─────────────────────
  useEffect(() => {
    const el = mapContainerRef.current
    if (!el || viewMode !== 'map') return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      setPanZoom(prev => {
        const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * factor))
        const k = s / prev.scale
        return { scale: s, x: cx * (1 - k) + prev.x * k, y: cy * (1 - k) + prev.y * k }
      })
    }

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      setPanZoom(prev => {
        if (e.touches.length === 1) {
          touchRef.current = {
            touches: [{ x: e.touches[0].clientX, y: e.touches[0].clientY }],
            tx: prev.x, ty: prev.y, scale: prev.scale, dist: 0,
          }
        } else if (e.touches.length >= 2) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          )
          touchRef.current = {
            touches: [
              { x: e.touches[0].clientX, y: e.touches[0].clientY },
              { x: e.touches[1].clientX, y: e.touches[1].clientY },
            ],
            tx: prev.x, ty: prev.y, scale: prev.scale, dist,
          }
        }
        return prev
      })
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const ts = touchRef.current
      if (!ts) return
      if (e.touches.length >= 2 && ts.touches.length >= 2) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        const k       = (newDist / ts.dist)
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ts.scale * k))
        const sk       = newScale / ts.scale
        const midX    = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const midY    = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const iMidX   = (ts.touches[0].x + ts.touches[1].x) / 2
        const iMidY   = (ts.touches[0].y + ts.touches[1].y) / 2
        setPanZoom({
          scale: newScale,
          x: iMidX * (1 - sk) + ts.tx * sk + (midX - iMidX),
          y: iMidY * (1 - sk) + ts.ty * sk + (midY - iMidY),
        })
      } else if (e.touches.length === 1 && ts.touches.length >= 1) {
        setPanZoom(prev => ({
          ...prev,
          x: ts.tx + e.touches[0].clientX - ts.touches[0].x,
          y: ts.ty + e.touches[0].clientY - ts.touches[0].y,
        }))
      }
    }

    const onTouchEnd = () => { touchRef.current = null }

    el.addEventListener('wheel',      onWheel,      { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd)
    return () => {
      el.removeEventListener('wheel',      onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [viewMode])

  // ── Mouse drag (window-level so out-of-bounds moves still work) ─────
  useEffect(() => {
    if (viewMode !== 'map') return
    const onMove = (e: MouseEvent) => {
      const dr = dragRef.current
      if (!dr) return
      setPanZoom(prev => ({ ...prev, x: dr.tx + e.clientX - dr.sx, y: dr.ty + e.clientY - dr.sy }))
    }
    const onUp = () => { dragRef.current = null; setIsPanning(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [viewMode])

  // ── Data / tooltip helpers ──────────────────────────────────────────
  const visitedSlugs = useMemo(() => new Set(trips.map(t => t.country)), [trips])

  const countryStats = useMemo(() => {
    const stats: Record<string, { trips: number; days: number }> = {}
    for (const t of trips) {
      if (!stats[t.country]) stats[t.country] = { trips: 0, days: 0 }
      stats[t.country].trips += 1
      stats[t.country].days  += tripDays(t)
    }
    return stats
  }, [trips])

  useEffect(() => {
    if (!countries.length || !trips.length) return
    console.log('[Map] Trip slugs:', [...visitedSlugs])
    const matched = countries
      .map(f => ({ id: String(f.id), slug: ISO_TO_SLUG[Number(f.id)] }))
      .filter(({ slug }) => slug && visitedSlugs.has(slug))
    console.log('[Map] Matched features:', matched)
  }, [countries, trips.length, visitedSlugs])

  const getCapColor = useCallback((f: object) => {
    const feat = f as GeoFeature
    const slug = ISO_TO_SLUG[Number(feat.id)]
    const isVisited = visitedSlugs.has(slug)
    // String comparison handles world-atlas string IDs vs numeric hoveredId
    const isHovered = hoveredId !== null && String(feat.id) === String(hoveredId)
    if (isHovered) return isVisited ? '#1EA876' : '#C8D0D6'
    return isVisited ? colors.visited : colors.unvisited
  }, [visitedSlugs, colors, hoveredId])

  // Shared tooltip renderer — used by both globe and 2D map
  const renderTooltip = (tip: { x: number; y: number; slug: string } | null) => {
    if (!tip) return null
    const { x, y, slug } = tip
    const name  = t(`countries.${slug}`, { defaultValue: slug })
    const flag  = COUNTRY_FLAGS[slug] ?? ''
    const stats = countryStats[slug]
    return (
      <div style={{
        position: 'fixed', left: x + 14, top: y - 40, zIndex: 300,
        pointerEvents: 'none',
        background: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderLeft: '4px solid #2DBF8A',
        padding: '8px 12px',
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'nowrap',
      }}>
        <div style={{ color: '#1a1a1a', fontSize: '13px', fontWeight: 700 }}>
          {flag} {name}
        </div>
        {stats && (
          <div style={{ color: '#6B7280', fontSize: '11px', fontWeight: 400, marginTop: '3px' }}>
            {stats.trips} trip{stats.trips !== 1 ? 's' : ''} · {stats.days} day{stats.days !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    )
  }

  // ── Stats bar data ──────────────────────────────────────────────────
  const uniqueCountries = useMemo(() => [...new Set(trips.map(t => t.country))], [trips])
  const totalDays = useMemo(() => trips.reduce((s, t) => s + tripDays(t), 0), [trips])
  const topCountry = useMemo(() => {
    if (!trips.length) return null
    const byCountry: Record<string, number> = {}
    for (const t of trips) byCountry[t.country] = (byCountry[t.country] ?? 0) + tripDays(t)
    return Object.entries(byCountry).sort(([, a], [, b]) => b - a)[0]
  }, [trips])

  const statsItems = [
    { label: t('map.totalCountries'), value: uniqueCountries.length },
    { label: t('map.totalDays'),      value: totalDays },
    {
      label: t('map.topCountry'),
      value: topCountry
        ? `${COUNTRY_FLAGS[topCountry[0]] ?? ''} ${t(`countries.${topCountry[0]}`, { defaultValue: topCountry[0] })}`
        : '—',
    },
  ]

  // Zoom toward the center of the map container (used by +/- buttons)
  const zoomAtCenter = useCallback((factor: number) => {
    const el = mapContainerRef.current
    if (!el) return
    const cx = el.offsetWidth / 2
    const cy = el.offsetHeight / 2
    clearTimeout(btnZoomTimer.current)
    setIsButtonZooming(true)
    setPanZoom(prev => {
      const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * factor))
      const k = s / prev.scale
      return { scale: s, x: cx * (1 - k) + prev.x * k, y: cy * (1 - k) + prev.y * k }
    })
    btnZoomTimer.current = setTimeout(() => setIsButtonZooming(false), 350)
  }, [])

  // ── Computed layout ─────────────────────────────────────────────────
  const globeH = Math.max(dims.h - 120 - TOGGLE_H, 200)
  // 2D map: full container width, ~60% of that as height (Been-app aspect ratio)
  const mapH   = Math.min(Math.round(dims.w * 0.6), globeH)
  const toggleBg    = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const inactiveClr = theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'

  const zoomBtnStyle: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 8, border: 'none',
    background: theme === 'dark' ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.92)',
    color: theme === 'dark' ? '#fff' : '#374151',
    fontSize: 20, lineHeight: '1', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)', fontFamily: 'Inter, system-ui, sans-serif',
    userSelect: 'none', WebkitUserSelect: 'none',
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: 'calc(100dvh - 56px)',
        background: colors.bg,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}
    >
      {/* ── Toggle ────────────────────────────────────────────────── */}
      <div style={{
        height: `${TOGGLE_H}px`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, padding: '0 1rem',
      }}>
        <div style={{
          display: 'inline-flex', background: toggleBg,
          borderRadius: '999px', padding: '3px', gap: '2px',
        }}>
          {(['globe', 'map'] as ViewMode[]).map(mode => {
            const isActive = viewMode === mode
            return (
              <motion.button
                key={mode}
                onClick={() => setViewMode(mode)}
                animate={{ backgroundColor: isActive ? '#2DBF8A' : 'rgba(0,0,0,0)', color: isActive ? '#fff' : inactiveClr }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                style={{
                  border: 'none', borderRadius: '999px', padding: '6px 18px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap', lineHeight: 1.4,
                }}
              >
                {mode === 'globe' ? `🌍 ${t('map.view3d')}` : `🗺️ ${t('map.view2d')}`}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* ── Map area ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* 3D Globe — always mounted to avoid WebGL teardown */}
        {countries.length > 0 ? (
          <div
            style={{ filter: GLOBE_SHADOW }}
            onMouseMove={e => {
              globeMouseRef.current = { x: e.clientX, y: e.clientY }
              // Keep tooltip position in sync while moving over the same country
              setGlobeTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
            }}
            onMouseLeave={() => { setGlobeTooltip(null); setHoveredId(null) }}
          >
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
              polygonLabel={() => ''}
              onPolygonHover={f => {
                const feat = f as GeoFeature | null
                setHoveredId(feat ? feat.id : null)
                if (feat) {
                  const slug = ISO_TO_SLUG[Number(feat.id)]
                  setGlobeTooltip(slug ? { ...globeMouseRef.current, slug } : null)
                } else {
                  setGlobeTooltip(null)
                }
              }}
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

        {/* Globe tooltip — React div, not the built-in globe label */}
        {viewMode === 'globe' && renderTooltip(globeTooltip)}

        {/* No-trips hint for globe mode */}
        {trips.length === 0 && countries.length > 0 && viewMode === 'globe' && (
          <div style={{
            position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
            background: colors.statBg, padding: '0.5rem 1rem', borderRadius: '2rem',
            fontSize: '0.8125rem',
            color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)', border: `1px solid rgba(255,255,255,0.12)`,
            whiteSpace: 'nowrap',
          }}>
            {t('map.noTrips')}
          </div>
        )}

        {/* 2D flat-map overlay — fades in over the globe */}
        <AnimatePresence>
          {viewMode === 'map' && (
            <motion.div
              key="flat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ position: 'absolute', inset: 0, background: colors.bg, overflow: 'hidden' }}
            >
              {/* Pan/zoom interaction surface */}
              <div
                ref={mapContainerRef}
                style={{ position: 'absolute', inset: 0, cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
                onMouseDown={e => {
                  if (e.button !== 0) return
                  setPanZoom(prev => {
                    dragRef.current = { sx: e.clientX, sy: e.clientY, tx: prev.x, ty: prev.y }
                    return prev
                  })
                  setIsPanning(true)
                }}
                onMouseLeave={() => setFlatTooltip(null)}
              >
                {/* SVG-space transform — zoom/pan via <g transform> keeps paths vector-sharp */}
                {!!topoData && (
                  <ComposableMap
                    width={dims.w}
                    height={mapH}
                    projectionConfig={{ scale: 155, center: [0, 10] }}
                    style={{ display: 'block', width: '100%', height: `${mapH}px`, background: 'transparent' }}
                  >
                    <g
                      style={{
                        transform: `translate(${panZoom.x}px,${panZoom.y}px) scale(${panZoom.scale})`,
                        transformOrigin: '0 0',
                        transition: isButtonZooming ? 'transform 0.3s ease-out' : 'none',
                      }}
                      shapeRendering="geometricPrecision"
                    >
                      <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
                        {({ geographies }) =>
                          geographies
                            // cut off Antarctica (ISO 010)
                            .filter(geo => String(geo.id) !== '10')
                            .map(geo => {
                            const slug = ISO_TO_SLUG[Number(geo.id)]
                            const isVisited = !!slug && visitedSlugs.has(slug)
                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill={isVisited ? '#2DBF8A' : '#E0E0E0'}
                                stroke="#FFFFFF"
                                strokeWidth={0.5}
                                vectorEffect="non-scaling-stroke"
                                onMouseEnter={e => {
                                  if (slug) setFlatTooltip({ x: e.clientX, y: e.clientY, slug })
                                }}
                                onMouseMove={e => {
                                  if (slug) setFlatTooltip({ x: e.clientX, y: e.clientY, slug })
                                }}
                                onMouseLeave={() => setFlatTooltip(null)}
                                style={{
                                  default: { outline: 'none' },
                                  hover: { fill: isVisited ? '#25A876' : '#CCCCCC', outline: 'none', cursor: 'pointer' },
                                  pressed: { outline: 'none' },
                                }}
                              />
                            )
                          })
                        }
                      </Geographies>
                    </g>
                  </ComposableMap>
                )}
              </div>

              {/* Zoom +/− buttons */}
              <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  style={zoomBtnStyle}
                  onClick={() => zoomAtCenter(1.5)}
                  title="Zoom in"
                >+</button>
                <button
                  style={zoomBtnStyle}
                  onClick={() => zoomAtCenter(1 / 1.5)}
                  title="Zoom out"
                >−</button>
              </div>

              {/* No-trips hint */}
              {trips.length === 0 && !!topoData && (
                <div style={{
                  position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
                  background: colors.statBg, padding: '0.5rem 1rem', borderRadius: '2rem',
                  fontSize: '0.8125rem',
                  color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)', border: `1px solid rgba(255,255,255,0.12)`,
                  whiteSpace: 'nowrap',
                }}>
                  {t('map.noTrips')}
                </div>
              )}

              {renderTooltip(flatTooltip)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <div style={{
        height: '120px', background: colors.statBg, backdropFilter: 'blur(12px)',
        borderTop: `1px solid rgba(255,255,255,0.08)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '1px', padding: '0 1rem', flexShrink: 0,
      }}>
        {statsItems.map((s, i) => (
          <div key={i} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '0.75rem 0.5rem',
            borderRight: i < statsItems.length - 1
              ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
              : 'none',
          }}>
            <span style={{
              fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 800,
              color: '#2DBF8A', lineHeight: 1, letterSpacing: '-0.02em',
              fontFamily: 'Inter, system-ui, sans-serif',
              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{s.value}</span>
            <span style={{
              fontSize: 'clamp(0.6875rem, 1.5vw, 0.8125rem)',
              color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
              marginTop: '0.25rem', textAlign: 'center',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.2,
            }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
