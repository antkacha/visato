declare module 'react-simple-maps' {
  import type { ReactNode, SVGProps, MouseEvent } from 'react'

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: Record<string, unknown>
    width?: number
    height?: number
    style?: React.CSSProperties
    className?: string
    children?: ReactNode
  }

  export interface GeographiesProps {
    geography: unknown
    children: (ctx: { geographies: GeoEntry[] }) => ReactNode
  }

  export interface GeoEntry {
    rsmKey: string
    id: string | number
    properties: Record<string, unknown>
    [key: string]: unknown
  }

  export interface GeographyProps extends Omit<SVGProps<SVGPathElement>, 'style'> {
    geography: GeoEntry
    fill?: string
    stroke?: string
    strokeWidth?: number
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void
    onMouseMove?: (event: MouseEvent<SVGPathElement>) => void
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void
    style?: {
      default?: React.CSSProperties
      hover?: React.CSSProperties & { cursor?: string }
      pressed?: React.CSSProperties
    }
  }

  export interface SphereProps {
    id: string
    fill?: string
    stroke?: string
    strokeWidth?: number
  }

  export const ComposableMap: React.FC<ComposableMapProps>
  export const Geographies: React.FC<GeographiesProps>
  export const Geography: React.FC<GeographyProps>
  export const Sphere: React.FC<SphereProps>
}
