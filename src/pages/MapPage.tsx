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
import { geoFeatureSlug } from '../constants/countryIsoMap'
import { differenceInDays, parseISO } from 'date-fns'
import { today } from '../utils/dateUtils'
import type { User } from '@supabase/supabase-js'
import ShareModal from '../components/ShareMap/ShareModal'

interface Props {
  trips: TripEntry[]
  user: User | null
}

interface GeoFeature {
  type: string
  id: string | number
  properties: Record<string, unknown>
  geometry: unknown
}

type ViewMode = 'globe' | 'map'

// Hardcoded Crimea polygon for the 2D flat-map overlay (renders on top of Russia)
const CRIMEA_GEO_JSON = {
  type: 'Feature',
  id: 'crimea',
  rsmKey: 'crimea-overlay',
  properties: { name: 'Ukraine' },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [32.49, 45.31], [32.50, 44.90], [33.18, 44.38], [33.72, 44.32],
      [34.22, 44.54], [34.87, 44.52], [35.17, 44.53], [35.53, 44.55],
      [36.10, 44.76], [36.62, 45.20], [36.63, 45.40], [36.41, 45.67],
      [35.10, 45.89], [34.06, 46.06], [33.58, 46.10], [33.05, 45.93],
      [32.62, 45.71], [32.49, 45.31],
    ]],
  },
}

// Return true if the centroid of a polygon ring falls within the given lon/lat bbox
function polyNearBbox(
  coords: number[][][],
  minLon: number, maxLon: number, minLat: number, maxLat: number,
): boolean {
  const outer = coords[0]
  let sumLon = 0, sumLat = 0
  for (const [lon, lat] of outer) { sumLon += lon; sumLat += lat }
  const cx = sumLon / outer.length, cy = sumLat / outer.length
  return cx >= minLon && cx <= maxLon && cy >= minLat && cy <= maxLat
}

/**
 * Post-process world-atlas features:
 * - Russia (ISO 643): extract any polygon whose centroid falls in Crimea (33-36°E, 44-46°N)
 *   and re-emit it as a Ukraine (ISO 804) feature so it renders with Ukraine's colour.
 * - Any feature whose polygons are centred near Cyprus (32-34°E, 34-36°N) gets
 *   re-labelled as Cyprus (ISO 196) so N.Cyprus / ESBA areas share the same colour/tooltip.
 */
function processWorldFeatures(features: GeoFeature[]): GeoFeature[] {
  const out: GeoFeature[] = []

  for (const feat of features) {
    const numId = Number(feat.id)
    const geom = feat.geometry as { type: string; coordinates: number[][][][] | number[][][] } | null
    if (!geom) { out.push(feat); continue }

    const polys: number[][][][] =
      geom.type === 'MultiPolygon'
        ? (geom.coordinates as number[][][][])
        : geom.type === 'Polygon'
          ? [(geom.coordinates as number[][][])]
          : []

    if (numId === 643) {
      // Russia — split off Crimea polygons
      const mainPolys  = polys.filter(p => !polyNearBbox(p, 33, 36, 44, 46))
      const crimeaPolys = polys.filter(p =>  polyNearBbox(p, 33, 36, 44, 46))

      out.push({ ...feat, geometry: { type: 'MultiPolygon', coordinates: mainPolys } })

      if (crimeaPolys.length > 0) {
        out.push({
          type: 'Feature',
          id: 804,
          properties: { name: 'Ukraine' },
          geometry: { type: 'MultiPolygon', coordinates: crimeaPolys },
        })
      }
      continue
    }

    // Re-label any feature whose polygons cluster around the Cyprus area
    const nearCyprus = polys.some(p => polyNearBbox(p, 32, 34, 34, 36))
    if (nearCyprus) {
      out.push({ ...feat, id: 196, properties: { ...feat.properties, name: 'Cyprus' } })
      continue
    }

    out.push(feat)
  }

  return out
}

// Continent → country slug mapping for the left panel list
const CONTINENT_COUNTRIES: Record<string, string[]> = {
  europe: [
    'albania', 'andorra', 'austria', 'belarus', 'belgium', 'bosnia_and_herzegovina',
    'bulgaria', 'croatia', 'cyprus', 'czech_republic', 'denmark', 'estonia',
    'finland', 'france', 'germany', 'greece', 'greenland', 'hungary', 'iceland',
    'ireland', 'italy', 'kosovo', 'latvia', 'liechtenstein', 'lithuania',
    'luxembourg', 'malta', 'moldova', 'monaco', 'montenegro', 'netherlands',
    'north_macedonia', 'norway', 'poland', 'portugal', 'romania', 'russia',
    'san_marino', 'serbia', 'slovakia', 'slovenia', 'spain', 'sweden',
    'switzerland', 'ukraine', 'united_kingdom', 'vatican',
  ],
  asia: [
    'afghanistan', 'armenia', 'azerbaijan', 'bahrain', 'bangladesh', 'bhutan',
    'brunei', 'cambodia', 'china', 'georgia', 'india', 'indonesia', 'iran',
    'iraq', 'israel', 'japan', 'jordan', 'kazakhstan', 'kuwait', 'kyrgyzstan',
    'laos', 'lebanon', 'malaysia', 'maldives', 'mongolia', 'myanmar', 'nepal',
    'north_korea', 'oman', 'pakistan', 'palestine', 'philippines', 'qatar',
    'saudi_arabia', 'singapore', 'south_korea', 'sri_lanka', 'syria', 'taiwan',
    'tajikistan', 'thailand', 'timor_leste', 'turkey', 'turkmenistan',
    'united_arab_emirates', 'uzbekistan', 'vietnam', 'yemen',
  ],
  americas: [
    'antigua_and_barbuda', 'argentina', 'bahamas', 'barbados', 'belize', 'bolivia',
    'brazil', 'canada', 'chile', 'colombia', 'costa_rica', 'cuba', 'dominica',
    'dominican_republic', 'ecuador', 'el_salvador', 'grenada', 'guatemala',
    'guyana', 'haiti', 'honduras', 'jamaica', 'mexico', 'nicaragua', 'panama',
    'paraguay', 'peru', 'saint_kitts_and_nevis', 'saint_lucia',
    'saint_vincent_and_the_grenadines', 'suriname', 'trinidad_and_tobago',
    'united_states', 'uruguay', 'venezuela',
  ],
  africa: [
    'algeria', 'angola', 'benin', 'botswana', 'burkina_faso', 'burundi',
    'cameroon', 'cape_verde', 'central_african_republic', 'chad', 'comoros',
    'congo', 'dr_congo', 'djibouti', 'egypt', 'equatorial_guinea', 'eritrea',
    'eswatini', 'ethiopia', 'gabon', 'gambia', 'ghana', 'guinea', 'guinea_bissau',
    'ivory_coast', 'kenya', 'lesotho', 'liberia', 'libya', 'madagascar', 'malawi',
    'mali', 'mauritania', 'mauritius', 'morocco', 'mozambique', 'namibia', 'niger',
    'nigeria', 'rwanda', 'sao_tome_and_principe', 'senegal', 'seychelles',
    'sierra_leone', 'somalia', 'south_africa', 'south_sudan', 'sudan', 'tanzania',
    'togo', 'tunisia', 'uganda', 'zambia', 'zimbabwe',
  ],
  oceania: [
    'australia', 'fiji', 'kiribati', 'marshall_islands', 'micronesia', 'nauru',
    'new_zealand', 'palau', 'papua_new_guinea', 'samoa', 'solomon_islands',
    'tonga', 'tuvalu', 'vanuatu',
  ],
}

const THEME = {
  dark: {
    bg: '#0c1424',
    visited: '#2DBF8A',
    // Globe
    ocean: '#1A2744',
    oceanEmissive: '#0F1C35',
    globeUnvisited: '#2D3748',
    globeHoverUnvisited: '#3D4A5C',
    globeShadow: 'drop-shadow(0px 25px 50px rgba(0,0,0,0.4))',
    // 2D map
    mapUnvisited: '#2D3748',
    mapHoverUnvisited: '#3D4A5C',
    mapBorder: '#4A5568',
    // Tooltip
    tooltipBg: '#1E2533',
    tooltipText: '#ffffff',
    tooltipSub: '#94A3B8',
    // UI
    statBg: 'rgba(13,20,36,0.85)',
  },
  light: {
    bg: '#F0FAF6',
    visited: '#2DBF8A',
    // Globe
    ocean: '#B8CCE0',
    oceanEmissive: '#8AAEC6',
    globeUnvisited: '#DDEAF5',
    globeHoverUnvisited: '#C8D0D6',
    globeShadow: 'drop-shadow(0px 25px 50px rgba(100,140,180,0.4))',
    // 2D map
    mapUnvisited: '#E0E0E0',
    mapHoverUnvisited: '#CCCCCC',
    mapBorder: '#FFFFFF',
    // Tooltip
    tooltipBg: '#ffffff',
    tooltipText: '#1a1a1a',
    tooltipSub: '#6B7280',
    // UI
    statBg: 'rgba(255,255,255,0.92)',
  },
}

const MIN_SCALE = 1   // no zooming out beyond full world view
const MAX_SCALE = 8

// d3-style translateExtent clamp: [[-200,-150],[vW+200,vH+150]]
function clampPan(tx: number, ty: number, k: number, vW: number, vH: number) {
  return {
    x: Math.min(200 * k, Math.max(tx, vW - (vW + 200) * k)),
    y: Math.min(150 * k, Math.max(ty, vH - (vH + 150) * k)),
  }
}

function tripDays(trip: TripEntry): number {
  const exit = trip.exitDate === 'ongoing' ? today() : trip.exitDate
  return differenceInDays(parseISO(exit), parseISO(trip.entryDate)) + 1
}

export default function MapPage({ trips, user }: Props) {
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
  const [shareOpen, setShareOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

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
  const globeResumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [isButtonZooming, setIsButtonZooming] = useState(false)
  const btnZoomTimer     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Ocean texture data URL (prevents three-globe default satellite image) ──
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2; canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = colors.ocean
    ctx.fillRect(0, 0, 2, 1)
    setOceanDataUrl(canvas.toDataURL('image/png'))
  }, [colors.ocean])

  // ── Load world atlas ────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then((topo: unknown) => {
        const typed = topo as Topology<{ countries: GeometryCollection }>
        const geo   = feature(typed, typed.objects.countries)
        const features = (geo as unknown as { features: GeoFeature[] }).features
        setCountries(processWorldFeatures(features))
        setTopoData(topo)
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

  // ── Globe material (shading varies by theme) ───────────────────────
  const applyGlobeMaterial = useCallback((g: any) => {
    const applyMat = (mat: any) => {
      mat.map = null
      mat.color.set(colors.ocean)
      mat.emissive.set(colors.oceanEmissive)
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
  }, [colors.ocean, colors.oceanEmissive])

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
    // Drag start stops rotation; resume is driven by mouseleave (not drag end)
    ctrl.addEventListener('start', () => {
      ctrl.autoRotate = false
      clearTimeout(globeResumeTimer.current)
    })
  }, [applyGlobeMaterial])

  useEffect(() => {
    const globe = globeRef.current
    if (globe) applyGlobeMaterial(globe as any)
  }, [applyGlobeMaterial])

  // Globe.gl caches the cap-color accessor internally; force re-evaluation when theme changes
  useEffect(() => {
    const g = globeRef.current as any
    if (!g) return
    try { g.polygonCapColor(getCapColor) } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  // Stop/start globe rotation when view mode changes; cancel any pending resume timer
  useEffect(() => {
    clearTimeout(globeResumeTimer.current)
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
        const nx = cx * (1 - k) + prev.x * k
        const ny = cy * (1 - k) + prev.y * k
        const { x, y } = clampPan(nx, ny, s, el.offsetWidth, el.offsetHeight)
        return { scale: s, x, y }
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
        const k        = (newDist / ts.dist)
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ts.scale * k))
        const sk       = newScale / ts.scale
        const midX    = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const midY    = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const iMidX   = (ts.touches[0].x + ts.touches[1].x) / 2
        const iMidY   = (ts.touches[0].y + ts.touches[1].y) / 2
        const nx = iMidX * (1 - sk) + ts.tx * sk + (midX - iMidX)
        const ny = iMidY * (1 - sk) + ts.ty * sk + (midY - iMidY)
        const { x, y } = clampPan(nx, ny, newScale, el.offsetWidth, el.offsetHeight)
        setPanZoom({ scale: newScale, x, y })
      } else if (e.touches.length === 1 && ts.touches.length >= 1) {
        const nx = ts.tx + e.touches[0].clientX - ts.touches[0].x
        const ny = ts.ty + e.touches[0].clientY - ts.touches[0].y
        setPanZoom(prev => {
          const { x, y } = clampPan(nx, ny, prev.scale, el.offsetWidth, el.offsetHeight)
          return { ...prev, x, y }
        })
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
      const el = mapContainerRef.current
      if (!el) return
      const nx = dr.tx + e.clientX - dr.sx
      const ny = dr.ty + e.clientY - dr.sy
      setPanZoom(prev => {
        const { x, y } = clampPan(nx, ny, prev.scale, el.offsetWidth, el.offsetHeight)
        return { ...prev, x, y }
      })
    }
    const onUp = () => { dragRef.current = null; setIsPanning(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [viewMode])

  // ── Mobile breakpoint ───────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
      .map(f => ({ id: String(f.id), slug: geoFeatureSlug(f.id, f.properties) }))
      .filter(({ slug }) => slug && visitedSlugs.has(slug))
    console.log('[Map] Matched features:', matched)
  }, [countries, trips.length, visitedSlugs])

  const getCapColor = useCallback((f: object) => {
    const feat = f as GeoFeature
    const slug = geoFeatureSlug(feat.id, feat.properties)
    const isVisited = !!slug && visitedSlugs.has(slug)
    // String comparison handles world-atlas string IDs vs numeric hoveredId
    const isHovered = hoveredId !== null && String(feat.id) === String(hoveredId)
    if (isHovered) return isVisited ? '#1EA876' : colors.globeHoverUnvisited
    return isVisited ? colors.visited : colors.globeUnvisited
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
        background: colors.tooltipBg,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderLeft: '4px solid #2DBF8A',
        padding: '8px 12px',
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'nowrap',
      }}>
        <div style={{ color: colors.tooltipText, fontSize: '13px', fontWeight: 700 }}>
          {flag} {name}
        </div>
        {stats && (
          <div style={{ color: colors.tooltipSub, fontSize: '11px', fontWeight: 400, marginTop: '3px' }}>
            {t('map.tripCount', { count: stats.trips })} · {t('map.dayCount', { count: stats.days })}
          </div>
        )}
      </div>
    )
  }

  // ── Panel stats ─────────────────────────────────────────────────────
  const uniqueCountries = useMemo(() => [...new Set(trips.map(t => t.country))], [trips])
  const totalDays = useMemo(() => trips.reduce((s, t) => s + tripDays(t), 0), [trips])
  const visitedContinents = useMemo(() => {
    let count = 0
    for (const slugs of Object.values(CONTINENT_COUNTRIES)) {
      if (slugs.some(s => visitedSlugs.has(s))) count++
    }
    return count
  }, [visitedSlugs])

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
      const nx = cx * (1 - k) + prev.x * k
      const ny = cy * (1 - k) + prev.y * k
      const { x, y } = clampPan(nx, ny, s, el.offsetWidth, el.offsetHeight)
      return { scale: s, x, y }
    })
    btnZoomTimer.current = setTimeout(() => setIsButtonZooming(false), 350)
  }, [])

  // ── Computed layout ─────────────────────────────────────────────────
  const globeH = Math.max(dims.h, 200)
  const mapH   = globeH
  const toggleBg    = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const inactiveClr = theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const panelBg     = theme === 'dark' ? '#0c1424' : '#FFFFFF'
  const panelBorder = theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#E5E7EB'
  const panelHeading = theme === 'dark' ? '#f1f5f9' : '#1F2937'
  const panelMuted   = theme === 'dark' ? '#94a3b8' : '#6B7280'

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
      style={{
        height: 'calc(100dvh - 56px)',
        background: colors.bg,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div style={{
        width: isMobile ? '100%' : '300px',
        minWidth: isMobile ? undefined : '300px',
        height: isMobile ? 'auto' : '100%',
        maxHeight: isMobile ? '50dvh' : undefined,
        flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: panelBg,
        borderRight: isMobile ? 'none' : `1px solid ${panelBorder}`,
        borderBottom: isMobile ? `1px solid ${panelBorder}` : 'none',
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* ── Fixed header (non-scrolling) ────────────────────────── */}
        <div style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
          {/* Title + Share */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: panelHeading, letterSpacing: '-0.01em' }}>
              {t('map.myMap')}
            </h2>
            <button
              onClick={() => setShareOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 8,
                border: '1.5px solid #2DBF8A', background: 'transparent',
                color: '#2DBF8A', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {t('share.button')}
            </button>
          </div>

          {/* Stats — 3-column grid with equal widths */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 0, marginBottom: 16,
            background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderRadius: 12, border: `1px solid ${panelBorder}`,
            overflow: 'hidden',
          }}>
            {[
              { value: uniqueCountries.length, label: t('map.countriesStat') },
              { value: visitedContinents,      label: t('map.continentsStat') },
              { value: totalDays,              label: t('map.daysStat') },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '14px 8px', textAlign: 'center',
                borderRight: i < 2 ? `1px solid ${panelBorder}` : 'none',
              }}>
                <div style={{
                  fontSize: 26, fontWeight: 800, color: '#2DBF8A',
                  lineHeight: 1, letterSpacing: '-0.03em',
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontSize: 10, color: panelMuted, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 5,
                  lineHeight: 1.2,
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable countries list ─────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {trips.length === 0 ? (
            <p style={{ fontSize: 13, color: panelMuted, margin: 0 }}>
              {t('map.noVisited')}
            </p>
          ) : (
            Object.entries(CONTINENT_COUNTRIES).map(([continentKey, allSlugs]) => {
              const visited = allSlugs.filter(s => visitedSlugs.has(s))
              if (visited.length === 0) return null
              return (
                <div
                  key={continentKey}
                  style={{
                    marginBottom: 10,
                    background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                    borderRadius: 12, border: `1px solid ${panelBorder}`,
                    padding: '14px 14px 12px',
                    boxShadow: theme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Continent header */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: panelHeading }}>
                      {t(`continents.${continentKey}`)}
                    </div>
                    <div style={{ fontSize: 12, color: panelMuted, marginTop: 2 }}>
                      {visited.length}/{allSlugs.length} {t('map.countriesStat').toLowerCase()}
                    </div>
                  </div>
                  {/* 2-column chip grid — always expanded */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5,
                  }}>
                    {visited.map(slug => (
                      <div
                        key={slug}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 8px', borderRadius: 20,
                          background: theme === 'dark' ? 'rgba(45,191,138,0.12)' : '#E8F5F0',
                          border: theme === 'dark' ? '1px solid rgba(45,191,138,0.25)' : '1px solid rgba(26,122,89,0.2)',
                          overflow: 'hidden',
                        }}
                      >
                        <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>
                          {COUNTRY_FLAGS[slug] ?? '🏳️'}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 500,
                          color: theme === 'dark' ? '#2DBF8A' : '#1A7A59',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}>
                          {t(`countries.${slug}`, { defaultValue: slug })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT SECTION — Globe / 2D Map ──────────────────────────── */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', background: colors.bg }}
      >
        {/* Floating view toggle — top-center of map area */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex',
        }}>
          <div style={{
            display: 'flex', background: toggleBg,
            borderRadius: 999, padding: 3, gap: 2,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
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
                    border: 'none', borderRadius: 999, padding: '6px 16px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap', lineHeight: 1.4,
                  }}
                >
                  {mode === 'globe' ? `🌍 ${t('map.view3d')}` : `🗺️ ${t('map.view2d')}`}
                </motion.button>
              )
            })}
          </div>
        </div>


        {/* 3D Globe — always mounted to avoid WebGL teardown */}
        {countries.length > 0 ? (
          <div
            style={{ filter: colors.globeShadow, overflow: 'hidden' }}
            onWheel={e => e.preventDefault()}
            onMouseEnter={() => {
              clearTimeout(globeResumeTimer.current)
              try { const g = globeRef.current as any; if (g) g.controls().autoRotate = false } catch (_) {}
            }}
            onMouseMove={e => {
              globeMouseRef.current = { x: e.clientX, y: e.clientY }
              setGlobeTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
            }}
            onMouseLeave={() => {
              setGlobeTooltip(null)
              setHoveredId(null)
              clearTimeout(globeResumeTimer.current)
              globeResumeTimer.current = setTimeout(() => {
                try { const g = globeRef.current as any; if (g) g.controls().autoRotate = true } catch (_) {}
              }, 2000)
            }}
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
                  const slug = geoFeatureSlug(feat.id, feat.properties)
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
                    style={{ display: 'block', width: '100%', height: '100%', background: 'transparent' }}
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
                            const slug = geoFeatureSlug(geo.id, geo.properties as Record<string, unknown>)
                            const isVisited = !!slug && visitedSlugs.has(slug)
                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill={isVisited ? '#2DBF8A' : colors.mapUnvisited}
                                stroke={colors.mapBorder}
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
                                  hover: { fill: isVisited ? '#25A876' : colors.mapHoverUnvisited, outline: 'none', cursor: 'pointer' },
                                  pressed: { outline: 'none' },
                                }}
                              />
                            )
                          })
                        }
                      </Geographies>

                      {/* Crimea overlay — shown as Ukrainian territory */}
                      <Geography
                        key="crimea-overlay"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        geography={CRIMEA_GEO_JSON as any}
                        fill={visitedSlugs.has('ukraine') ? '#2DBF8A' : colors.mapUnvisited}
                        stroke={colors.mapBorder}
                        strokeWidth={0.5}
                        vectorEffect="non-scaling-stroke"
                        onMouseEnter={e => setFlatTooltip({ x: e.clientX, y: e.clientY, slug: 'ukraine' })}
                        onMouseMove={e => setFlatTooltip({ x: e.clientX, y: e.clientY, slug: 'ukraine' })}
                        onMouseLeave={() => setFlatTooltip(null)}
                        style={{
                          default: { outline: 'none' },
                          hover: { fill: visitedSlugs.has('ukraine') ? '#25A876' : colors.mapHoverUnvisited, outline: 'none', cursor: 'pointer' },
                          pressed: { outline: 'none' },
                        }}
                      />
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

      {/* ── Share modal ───────────────────────────────────────────── */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        trips={trips}
        topoData={topoData}
        user={user}
      />
    </div>
  )
}
