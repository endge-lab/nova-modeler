import type { ModelerPoint } from '@/domain/types/model/geometry.types'
import type { ModelerElement } from '@/domain/types/elements/element.types'

export interface ModelerEdgeEndpoint {
  elementId?: string
  portId?: string
  point?: ModelerPoint
}

export interface ModelerEdgeWaypoint extends ModelerPoint {}

export interface ModelerEdgeWaypointHandleDescriptor extends ModelerPoint {
  elementId: string
  waypointIndex: number
  size: number
  cursor?: string
  virtual?: boolean
}

export interface ModelerEdgeSegmentHandleDescriptor extends ModelerPoint {
  elementId: string
  segmentIndex: number
  size: number
  cursor?: string
  virtual: true
}

export interface ModelerEdgeElement<TData extends Record<string, unknown> = Record<string, unknown>>
  extends ModelerElement<TData> {
  source: ModelerEdgeEndpoint
  target: ModelerEdgeEndpoint
  waypoints: Array<ModelerEdgeWaypoint>
}

export function isModelerEdgeElement(element: ModelerElement): element is ModelerEdgeElement {
  return Boolean((element as Partial<ModelerEdgeElement>).source && (element as Partial<ModelerEdgeElement>).target)
}
