import type {
  ModelerEdgeElement,
  ModelerElement,
  ModelerModel,
  ModelerPluginContext,
  ModelerPoint,
  ModelerRect,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'

/**
 * Считает геометрию модели для экспортов без привязки к viewport.
 */
export class ModelerExportGeometry {
  /**
   * Возвращает полный путь edge с учетом виртуальных якорей элементов.
   */
  resolveEdgePath(model: ModelerModel, edge: ModelerEdgeElement, context?: ModelerPluginContext): Array<ModelerPoint> {
    if (context) return MODEL_ELEMENTS_RUNTIME.edges.createPath(context, edge)
    const lookup = new Map(model.elements.map(element => [element.id, element]))
    const sourceReference = edge.waypoints[0]
      ?? this.resolveEndpointReference(lookup.get(edge.target.elementId ?? ''), edge.target.point)
      ?? edge.source.point
      ?? { x: 0, y: 0 }
    const source = this.resolveEndpointPoint(lookup.get(edge.source.elementId ?? ''), edge.source.point, sourceReference)
    const targetReference = edge.waypoints[edge.waypoints.length - 1] ?? source
    const target = this.resolveEndpointPoint(lookup.get(edge.target.elementId ?? ''), edge.target.point, targetReference)
    return [
      source,
      ...edge.waypoints.map(point => ({ x: point.x, y: point.y })),
      target,
    ]
  }

  /**
   * Возвращает tight bounds всех элементов модели.
   */
  resolveContentBounds(model: ModelerModel, context?: ModelerPluginContext): ModelerRect {
    let bounds: ModelerRect | null = null
    for (const element of model.elements) {
      const elementBounds = isModelerEdgeElement(element)
        ? this.resolvePathBounds(this.resolveEdgePath(model, element, context))
        : this.resolveElementBounds(element)
      bounds = bounds ? unionRects(bounds, elementBounds) : elementBounds
    }
    return bounds ?? { x: 0, y: 0, width: 1, height: 1 }
  }

  private resolveElementBounds(element: ModelerElement): ModelerRect {
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    }
  }

  private resolvePathBounds(path: Array<ModelerPoint>): ModelerRect {
    if (path.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const point of path) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    }
  }

  private resolveEndpointReference(element: ModelerElement | undefined, point: ModelerPoint | undefined): ModelerPoint | undefined {
    if (element) return this.elementCenter(element)
    return point ? { ...point } : undefined
  }

  private resolveEndpointPoint(
    element: ModelerElement | undefined,
    point: ModelerPoint | undefined,
    reference: ModelerPoint | undefined,
  ): ModelerPoint {
    if (!element) return point ? { ...point } : { x: 0, y: 0 }
    return MODEL_ELEMENTS_RUNTIME.anchors.resolveElementAnchor(element, reference)
  }

  private elementCenter(element: ModelerElement): ModelerPoint {
    return {
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
    }
  }
}

function unionRects(a: ModelerRect, b: ModelerRect): ModelerRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  }
}
