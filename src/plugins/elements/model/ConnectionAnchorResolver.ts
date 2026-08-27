import type {
  ModelerEdgeEndpoint,
  ModelerElement,
  ModelerPoint,
} from '@/domain/types/index'
import type { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'
import { BASIC_RECT_TYPE } from '@/elements/basic/rect/basic-rect.factory'
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import { BPMN_EVENT_TYPE } from '@/elements/bpmn/event/bpmn-event.factory'
import { BPMN_GATEWAY_TYPE } from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import { BPMN_SUB_PROCESS_TYPE } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import { BPMN_TASK_TYPE } from '@/elements/bpmn/task/bpmn-task.factory'

export class ConnectionAnchorResolver {
  constructor(private readonly _geometry: ElementsGeometry) {}

  isVirtualAnchorElement(element: ModelerElement): boolean {
    return element.type === BPMN_EVENT_TYPE
      || element.type === BPMN_GATEWAY_TYPE
      || element.type === BPMN_TASK_TYPE
      || element.type === BPMN_SUB_PROCESS_TYPE
      || element.type === BPMN_CALL_ACTIVITY_TYPE
      || element.type === BASIC_RECT_TYPE
  }

  resolveEndpoint(element: ModelerElement | undefined, endpoint: ModelerEdgeEndpoint, reference: ModelerPoint | undefined): ModelerPoint {
    if (!element || !this.isVirtualAnchorElement(element)) {
      return endpoint.point ? { ...endpoint.point } : { x: 0, y: 0 }
    }
    return this.resolveElementAnchor(element, reference)
  }

  resolveElementAnchor(element: ModelerElement, reference: ModelerPoint | undefined): ModelerPoint {
    const center = this._geometry.elementCenter(element)
    const localReference = reference
      ? this._geometry.unrotatePoint(element, reference)
      : {
          x: center.x + Math.max(1, element.width / 2),
          y: center.y,
        }
    const localAnchor = element.type === BPMN_EVENT_TYPE
      ? this._resolveEllipseAnchor(element, localReference)
      : element.type === BPMN_GATEWAY_TYPE
        ? this._resolveDiamondAnchor(element, localReference)
        : this._resolveRectAnchor(element, localReference)
    return this._geometry.rotatePoint(element, localAnchor)
  }

  private _resolveRectAnchor(element: ModelerElement, reference: ModelerPoint): ModelerPoint {
    const center = this._geometry.elementCenter(element)
    const dx = reference.x - center.x
    const dy = reference.y - center.y
    if (dx === 0 && dy === 0) {
      return { x: element.x + element.width, y: center.y }
    }
    const halfWidth = Math.max(element.width / 2, 0.0001)
    const halfHeight = Math.max(element.height / 2, 0.0001)
    const scale = Math.min(
      Math.abs(dx) > 0 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY,
      Math.abs(dy) > 0 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY,
    )
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale,
    }
  }

  private _resolveEllipseAnchor(element: ModelerElement, reference: ModelerPoint): ModelerPoint {
    const center = this._geometry.elementCenter(element)
    const dx = reference.x - center.x
    const dy = reference.y - center.y
    if (dx === 0 && dy === 0) {
      return { x: element.x + element.width, y: center.y }
    }
    const radiusX = Math.max(element.width / 2, 0.0001)
    const radiusY = Math.max(element.height / 2, 0.0001)
    const scale = 1 / Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY))
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale,
    }
  }

  private _resolveDiamondAnchor(element: ModelerElement, reference: ModelerPoint): ModelerPoint {
    const center = this._geometry.elementCenter(element)
    const dx = reference.x - center.x
    const dy = reference.y - center.y
    if (dx === 0 && dy === 0) {
      return { x: element.x + element.width, y: center.y }
    }
    const halfWidth = Math.max(element.width / 2, 0.0001)
    const halfHeight = Math.max(element.height / 2, 0.0001)
    const scale = 1 / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight)
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale,
    }
  }
}
