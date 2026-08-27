import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeSegmentHandleDescriptor,
  ModelerEdgeWaypointHandleDescriptor,
  ModelerElement,
  ModelerModel,
  ModelerPluginContext,
  ModelerPoint,
} from '@/domain/types/index'
import type { ConnectionAnchorResolver } from '@/plugins/elements/model/ConnectionAnchorResolver'
import type { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'
import type { ElementsPorts } from '@/plugins/elements/model/ElementsPorts'
import { isModelerEdgeElement } from '@/domain/types/index'

const EDGE_WAYPOINT_HANDLE_SIZE = 14
const EDGE_SEGMENT_HANDLE_SIZE = 14
const EDGE_SEGMENT_HIT_TOLERANCE = 10

export class ElementsEdges {
  private readonly _elementLookupCache = new WeakMap<ModelerModel, Map<string, ModelerElement>>()

  constructor(
    private readonly _geometry: ElementsGeometry,
    private readonly _ports: ElementsPorts,
    private readonly _anchors: ConnectionAnchorResolver,
  ) {}

  isEdge(element: ModelerElement): element is ModelerEdgeElement {
    return isModelerEdgeElement(element)
  }

  createPath(context: ModelerPluginContext, element: ModelerEdgeElement): Array<ModelerPoint> {
    const sourceReference = this._resolveSourceReference(context, element)
    const source = this.resolveEndpointPoint(context, element.source, sourceReference)
    const targetReference = element.waypoints[element.waypoints.length - 1] ?? source
    const target = this.resolveEndpointPoint(context, element.target, targetReference)
    return [
      source,
      ...element.waypoints.map(point => ({ x: point.x, y: point.y })),
      target,
    ]
  }

  createWaypointHandles(element: ModelerEdgeElement): Array<ModelerEdgeWaypointHandleDescriptor> {
    return element.waypoints.map((point, waypointIndex) => ({
      elementId: element.id,
      waypointIndex,
      x: point.x,
      y: point.y,
      size: EDGE_WAYPOINT_HANDLE_SIZE,
      cursor: 'move',
    }))
  }

  createSegmentHandles(context: ModelerPluginContext, element: ModelerEdgeElement): Array<ModelerEdgeSegmentHandleDescriptor> {
    const path = this.createPath(context, element)
    const result: Array<ModelerEdgeSegmentHandleDescriptor> = []
    for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex += 1) {
      const start = path[segmentIndex]!
      const end = path[segmentIndex + 1]!
      if (this._geometry.distance(start, end) <= 0) {
        continue
      }
      result.push({
        elementId: element.id,
        segmentIndex,
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
        size: EDGE_SEGMENT_HANDLE_SIZE,
        cursor: 'move',
        virtual: true,
      })
    }
    return result
  }

  createSegmentHandleAtPoint(
    context: ModelerPluginContext,
    element: ModelerEdgeElement,
    point: ModelerPoint,
  ): ModelerEdgeSegmentHandleDescriptor | null {
    const path = this.createPath(context, element)
    let best: { point: ModelerPoint, distance: number, segmentIndex: number } | null = null
    for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex += 1) {
      const start = path[segmentIndex]!
      const end = path[segmentIndex + 1]!
      const projected = this._projectPointToSegment(point, start, end)
      const distance = this._geometry.distance(point, projected)
      if (!best || distance < best.distance) {
        best = { point: projected, distance, segmentIndex }
      }
    }
    const tolerance = EDGE_SEGMENT_HIT_TOLERANCE / Math.max(context.getViewport().scale, 0.0001)
    if (!best || best.distance > tolerance) {
      return null
    }
    return {
      elementId: element.id,
      segmentIndex: best.segmentIndex,
      x: best.point.x,
      y: best.point.y,
      size: EDGE_SEGMENT_HANDLE_SIZE,
      cursor: 'move',
      virtual: true,
    }
  }

  resolveEndpointPoint(context: ModelerPluginContext, endpoint: ModelerEdgeEndpoint, reference?: ModelerPoint): ModelerPoint {
    if (endpoint.elementId && endpoint.portId) {
      const element = this._findElement(context, endpoint.elementId)
      const definition = element ? context.getElementRegistry().get(element.type) : undefined
      if (element && this._anchors.isVirtualAnchorElement(element)) {
        return this._anchors.resolveEndpoint(element, endpoint, reference)
      }
      if (element && definition) {
        const ports = this._ports.createElementPorts(
          element,
          definition.getPorts?.(context, element) ?? [],
        )
        const port = ports.find(item => item.id === endpoint.portId)
        if (port) {
          return { x: port.x, y: port.y }
        }
      }
    }
    if (endpoint.elementId) {
      const element = this._findElement(context, endpoint.elementId)
      if (element) {
        return this._anchors.resolveEndpoint(element, endpoint, reference)
      }
    }
    return endpoint.point ? { ...endpoint.point } : { x: 0, y: 0 }
  }

  distanceToPath(point: ModelerPoint, path: Array<ModelerPoint>): number {
    if (path.length < 2) {
      return Number.POSITIVE_INFINITY
    }
    let distance = Number.POSITIVE_INFINITY
    for (let index = 0; index < path.length - 1; index += 1) {
      distance = Math.min(distance, this._distanceToSegment(point, path[index]!, path[index + 1]!))
    }
    return distance
  }

  private _distanceToSegment(point: ModelerPoint, start: ModelerPoint, end: ModelerPoint): number {
    return this._geometry.distance(point, this._projectPointToSegment(point, start, end))
  }

  private _projectPointToSegment(point: ModelerPoint, start: ModelerPoint, end: ModelerPoint): ModelerPoint {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) {
      return { ...start }
    }
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    return {
      x: start.x + t * dx,
      y: start.y + t * dy,
    }
  }

  private _resolveSourceReference(context: ModelerPluginContext, element: ModelerEdgeElement): ModelerPoint {
    if (element.waypoints[0]) {
      return element.waypoints[0]
    }
    const targetElement = element.target.elementId
      ? this._findElement(context, element.target.elementId)
      : undefined
    if (targetElement) {
      return this._geometry.elementCenter(targetElement)
    }
    return element.target.point ? { ...element.target.point } : this.resolveEndpointPoint(context, element.target)
  }

  private _findElement(context: ModelerPluginContext, id: string): ModelerElement | undefined {
    const model = context.getModel()
    let lookup = this._elementLookupCache.get(model)
    if (!lookup) {
      lookup = new Map(model.elements.map(element => [element.id, element]))
      this._elementLookupCache.set(model, lookup)
    }
    return lookup.get(id)
  }
}
