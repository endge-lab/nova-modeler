import type {
  ModelerEdgeElement,
  ModelerEdgeWaypoint,
  ModelerPluginContext,
  ModelerPoint,
} from '@/domain/types/index'
import type { ElementsEdges } from '@/plugins/elements/model/ElementsEdges'
import type { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'

const COLLINEAR_TOLERANCE_PX = 6
const MIN_WAYPOINT_DISTANCE_PX = 4

export class ElementsRouteOptimizer {
  constructor(
    private readonly geometry: ElementsGeometry,
    private readonly edges: ElementsEdges,
  ) {}

  optimizeWaypoints(
    context: ModelerPluginContext,
    element: ModelerEdgeElement,
    waypoints: Array<ModelerEdgeWaypoint>,
  ): Array<ModelerEdgeWaypoint> {
    const scale = Math.max(context.getViewport().scale, 0.0001)
    const collinearTolerance = COLLINEAR_TOLERANCE_PX / scale
    const minDistance = MIN_WAYPOINT_DISTANCE_PX / scale
    let next = waypoints.map(point => ({ x: point.x, y: point.y }))
    next = this.removeNearDuplicates(next, minDistance)
    return this.removeCollinear(context, element, next, collinearTolerance)
  }

  private removeNearDuplicates(points: Array<ModelerEdgeWaypoint>, minDistance: number): Array<ModelerEdgeWaypoint> {
    const result: Array<ModelerEdgeWaypoint> = []
    for (const point of points) {
      const previous = result[result.length - 1]
      if (previous && this.geometry.distance(previous, point) < minDistance) continue
      result.push(point)
    }
    return result
  }

  private removeCollinear(
    context: ModelerPluginContext,
    element: ModelerEdgeElement,
    waypoints: Array<ModelerEdgeWaypoint>,
    tolerance: number,
  ): Array<ModelerEdgeWaypoint> {
    const result = waypoints.map(point => ({ x: point.x, y: point.y }))
    let changed = true
    while (changed) {
      changed = false
      for (let index = 0; index < result.length; index += 1) {
        const probe = result[index]!
        const testWaypoints = result.filter((_point, itemIndex) => itemIndex !== index)
        const testElement = { ...element, waypoints: testWaypoints }
        const path = this.edges.createPath(context, testElement)
        const previous = path[index]!
        const next = path[index + 1]!
        if (previous && next && distanceToSegment(probe, previous, next) <= tolerance) {
          result.splice(index, 1)
          changed = true
          break
        }
      }
    }
    return result
  }
}

function distanceToSegment(point: ModelerPoint, start: ModelerPoint, end: ModelerPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}
