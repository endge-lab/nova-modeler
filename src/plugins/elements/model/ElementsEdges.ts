import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypointHandleDescriptor,
  ModelerElement,
  ModelerPluginContext,
  ModelerPoint,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import type { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'
import type { ElementsPorts } from '@/plugins/elements/model/ElementsPorts'

const EDGE_WAYPOINT_HANDLE_SIZE = 9

export class ElementsEdges {
  constructor(
    private readonly geometry: ElementsGeometry,
    private readonly ports: ElementsPorts,
  ) {}

  isEdge(element: ModelerElement): element is ModelerEdgeElement {
    return isModelerEdgeElement(element)
  }

  createPath(context: ModelerPluginContext, element: ModelerEdgeElement): Array<ModelerPoint> {
    return [
      this.resolveEndpointPoint(context, element.source),
      ...element.waypoints.map(point => ({ x: point.x, y: point.y })),
      this.resolveEndpointPoint(context, element.target),
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

  resolveEndpointPoint(context: ModelerPluginContext, endpoint: ModelerEdgeEndpoint): ModelerPoint {
    if (endpoint.elementId && endpoint.portId) {
      const element = context.getModel().elements.find(item => item.id === endpoint.elementId)
      const definition = element ? context.getElementRegistry().get(element.type) : undefined
      if (element && definition) {
        const ports = this.ports.createElementPorts(
          element,
          definition.getPorts?.(context, element) ?? [],
        )
        const port = ports.find(item => item.id === endpoint.portId)
        if (port) return { x: port.x, y: port.y }
      }
    }
    return endpoint.point ? { ...endpoint.point } : { x: 0, y: 0 }
  }

  distanceToPath(point: ModelerPoint, path: Array<ModelerPoint>): number {
    if (path.length < 2) return Number.POSITIVE_INFINITY
    let distance = Number.POSITIVE_INFINITY
    for (let index = 0; index < path.length - 1; index += 1) {
      distance = Math.min(distance, this.distanceToSegment(point, path[index]!, path[index + 1]!))
    }
    return distance
  }

  private distanceToSegment(point: ModelerPoint, start: ModelerPoint, end: ModelerPoint): number {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) {
      return this.geometry.distance(point, start)
    }
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    return this.geometry.distance(point, {
      x: start.x + t * dx,
      y: start.y + t * dy,
    })
  }
}
