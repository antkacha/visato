import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
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
  id: number
  properties: Record<string, unknown>
  geometry: unknown
}

// Ocean/water colors per theme
const THEME = {
  dark: {
    bg: '#0c1424',
    ocean: '#1a2d4a',
    visited: '#2DBF8A',
    unvisited: '#1e2d3d',
    border: 'rgba(255,255,255,0.06)',
    atmosphere: '#1a3a6e',
    statBg: 'rgba(13,20,36,0.85)',
  },
  light: {
    bg: '#F0FAF6',
    ocean: '#E8F5F0',
    visited: '#2DBF8A',
    unvisited: '#C8D6D0',
    border: '#FFFFFF',
    atmosphere: '#2DBF8A',
    statBg: 'rgba(255,255,255,0.92)',
  },
}

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

  // Load world atlas
  useEffect(() => {
    import('world-atlas/countries-110m.json').then((mod) => {
      const topo = mod.default as unknown as Topology<{ countries: GeometryCollection }>
      const geo = feature(topo, topo.objects.countries)
      setCountries((geo as unknown as { features: GeoFeature[] }).features)
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
    const mat = g.globeMaterial()
    mat.map = null            // Remove satellite texture map
    mat.needsUpdate = true
    mat.color.set('#000000') // Black diffuse so lights have no effect
    mat.emissive.set(colors.ocean)
    mat.emissiveIntensity = 1
  }, [colors.ocean])

  // Set ocean color and auto-rotation on globe ready
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return
    const g = globe as any

    applyGlobeMaterial(g)

    // Clear scene and renderer backgrounds
    const scene = g.scene()
    scene.background = null
    g.renderer().setClearColor(0x000000, 0)

    // Remove DirectionalLights so polygons are also evenly lit
    for (let i = scene.children.length - 1; i >= 0; i--) {
      if (scene.children[i].type === 'DirectionalLight') scene.remove(scene.children[i])
    }
    scene.children.forEach((c: any) => {
      if (c.type === 'AmbientLight') c.intensity = 1.5
    })

    const ctrl = g.controls()
    ctrl.autoRotate = true
    ctrl.autoRotateSpeed = 0.4
    let timer: ReturnType<typeof setTimeout>
    ctrl.addEventListener('start', () => { ctrl.autoRotate = false; clearTimeout(timer) })
    ctrl.addEventListener('end', () => {
      timer = setTimeout(() => { ctrl.autoRotate = true }, 2000)
    })
  }, [applyGlobeMaterial])

  // Re-apply when theme changes
  useEffect(() => {
    const globe = globeRef.current
    if (globe) applyGlobeMaterial(globe as any)
  }, [applyGlobeMaterial])

  // Visited countries set
  const visitedSlugs = useMemo(
    () => new Set(trips.map((t) => t.country)),
    [trips]
  )

  const getCapColor = useCallback(
    (f: object) => {
      const feat = f as GeoFeature
      const slug = ISO_TO_SLUG[feat.id]
      return visitedSlugs.has(slug) ? colors.visited : colors.unvisited
    },
    [visitedSlugs, colors]
  )

  const getLabel = useCallback(
    (f: object) => {
      const feat = f as GeoFeature
      const slug = ISO_TO_SLUG[feat.id]
      if (!slug) return ''
      const name = t(`countries.${slug}`, { defaultValue: slug })
      const flag = COUNTRY_FLAGS[slug] ?? ''
      const isVisited = visitedSlugs.has(slug)
      return `<div style="
        background: rgba(0,0,0,0.75);
        color: #fff;
        padding: 4px 10px;
        border-radius: 6px;
        font-family: Inter, sans-serif;
        font-size: 13px;
        font-weight: 500;
        pointer-events: none;
        white-space: nowrap;
        border: 1px solid ${isVisited ? '#2DBF8A' : 'rgba(255,255,255,0.15)'};
      ">${flag} ${name}</div>`
    },
    [t, visitedSlugs]
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

  const stats = [
    {
      label: t('map.totalCountries'),
      value: uniqueCountries.length,
      suffix: '',
    },
    {
      label: t('map.totalDays'),
      value: totalDays,
      suffix: '',
    },
    {
      label: t('map.topCountry'),
      value: topCountry
        ? `${COUNTRY_FLAGS[topCountry[0]] ?? ''} ${t(`countries.${topCountry[0]}`, { defaultValue: topCountry[0] })}`
        : '—',
      suffix: '',
    },
  ]

  const globeH = Math.max(dims.h - 120, 200)

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
      {/* Globe */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {countries.length > 0 && (
          <Globe
            ref={globeRef}
            width={dims.w}
            height={globeH}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl={null as unknown as string}
            showAtmosphere={false}
            polygonsData={countries}
            polygonCapColor={getCapColor}
            polygonSideColor={() => 'transparent'}
            polygonStrokeColor={() => colors.border}
            polygonLabel={getLabel}
            onPolygonHover={(f) => setHovered(f as GeoFeature | null)}
            onGlobeReady={handleGlobeReady}
          />
        )}
        {/* Loading state */}
        {countries.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
            fontSize: '0.875rem',
          }}>
            Loading globe…
          </div>
        )}
        {/* No trips hint */}
        {trips.length === 0 && countries.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '1rem', left: '50%',
            transform: 'translateX(-50%)',
            background: colors.statBg,
            padding: '0.5rem 1rem',
            borderRadius: '2rem',
            fontSize: '0.8125rem',
            color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${colors.border}`,
            whiteSpace: 'nowrap',
          }}>
            {t('map.noTrips')}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{
        height: '120px',
        background: colors.statBg,
        backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1px',
        padding: '0 1rem',
        flexShrink: 0,
      }}>
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem 0.5rem',
              borderRight: i < stats.length - 1 ? `1px solid ${colors.border}` : 'none',
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
