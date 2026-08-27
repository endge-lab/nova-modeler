import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElement,
  ModelerElementInput,
  ModelerPluginContext,
  ModelerPoint,
} from '@/domain/types/index'
import type { ElementsConnection } from '@/plugins/elements/model/ElementsConnection'
import type { ElementsEdgePreview } from '@/plugins/elements/model/ElementsEdgePreview'
import { isModelerEdgeElement } from '@/domain/types/index'
import { BPMN_BOUNDARY_EVENT_TYPE } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import { BPMN_EVENT_TYPE } from '@/elements/bpmn/event/bpmn-event.factory'
import { createBpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.factory'
import { BPMN_GATEWAY_TYPE } from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import { BPMN_SUB_PROCESS_TYPE } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import { BPMN_TASK_TYPE } from '@/elements/bpmn/task/bpmn-task.factory'

export interface ElementsConnectionEdgeFactory {
  idPrefix: string
  previewId: string
  create: (input: ElementsConnectionEdgeInput) => ModelerEdgeElement
  canStart?: (context: ModelerPluginContext, element: ModelerElement) => boolean
  canComplete?: (context: ModelerPluginContext, sourceElement: ModelerElement, targetElement: ModelerElement) => boolean
}

export interface ElementsConnectionEdgeInput extends ModelerElementInput {
  source: ModelerEdgeEndpoint
  target: ModelerEdgeEndpoint
  waypoints: Array<ModelerEdgeWaypoint>
}

const DEFAULT_EDGE_FACTORY: ElementsConnectionEdgeFactory = {
  idPrefix: 'bpmn-flow',
  previewId: 'bpmn-flow-preview',
  create: input => createBpmnFlowElement(input),
  canStart: (_context, element) => isBpmnFlowNode(element),
  canComplete: (_context, source, target) => isBpmnFlowNode(source) && isBpmnFlowNode(target),
}

export class ElementsConnectionFlow {
  private _createCounter = 0
  private _edgeFactory = DEFAULT_EDGE_FACTORY

  constructor(
    private readonly _connection: ElementsConnection,
    private readonly _preview: ElementsEdgePreview,
  ) {}

  useDefaultEdgeFactory(): void {
    this._edgeFactory = DEFAULT_EDGE_FACTORY
  }

  useEdgeFactory(factory: ElementsConnectionEdgeFactory): void {
    this._edgeFactory = factory
  }

  resetEdgeFactory(): void {
    this.useDefaultEdgeFactory()
  }

  beginFromPort(
    context: ModelerPluginContext,
    elementId: string,
    portId: string,
    origin: 'port-drag' | 'tool' | 'context-pad',
  ): boolean {
    const point = this._connection.resolvePortPoint(context, elementId, portId)
    if (!point || !this.canStart(context, elementId)) {
      return false
    }
    this._connection.begin({
      origin,
      source: this._connection.createEndpoint(elementId, portId, point),
      sourceElementId: elementId,
      sourcePortId: portId,
      sourcePoint: point,
      pointerPoint: point,
    })
    this.updatePreviewToPoint(context, point)
    return true
  }

  beginFromElement(
    context: ModelerPluginContext,
    elementId: string,
    origin: 'tool' | 'context-pad',
    referencePoint?: ModelerPoint,
  ): boolean {
    if (!this.canStart(context, elementId)) {
      return false
    }
    const source = this._connection.createEndpointFromElement(context, elementId, referencePoint)
    if (!source) {
      return false
    }
    this._connection.begin({
      origin,
      source: source.endpoint,
      sourceElementId: elementId,
      sourcePortId: source.port?.id,
      sourcePoint: source.point,
      pointerPoint: source.point,
    })
    this.updatePreviewToPoint(context, source.point)
    return true
  }

  updatePreviewToPoint(context: ModelerPluginContext, point: ModelerPoint, target?: ReturnType<ModelerPluginContext['hitTest']>): void {
    const state = this._connection.get()
    if (!state) {
      return
    }
    const resolvedTarget = target ?? context.hitTest(context.worldToScreen(point))
    const targetResolution = this._resolveTargetEndpoint(context, resolvedTarget, point)
    const sourcePoint = this._connection.resolveElementPoint(context, state.sourceElementId, targetResolution.point) ?? state.sourcePoint
    const source = {
      elementId: state.sourceElementId,
      portId: state.sourcePortId,
      point: { ...sourcePoint },
    }
    this._connection.update({
      source,
      sourcePoint,
      pointerPoint: point,
      targetElementId: targetResolution.elementId,
      targetPortId: targetResolution.portId,
    })
    const edgeInput: ElementsConnectionEdgeInput = {
      id: this._edgeFactory.previewId,
      source,
      target: targetResolution.endpoint,
      waypoints: [this._connection.midpoint(sourcePoint, targetResolution.point)],
    }
    this._preview.set(this._edgeFactory.create(edgeInput))
  }

  completeAtTarget(context: ModelerPluginContext, target: ReturnType<ModelerPluginContext['hitTest']>, fallbackPoint: ModelerPoint): ModelerElement | null {
    const state = this._connection.get()
    if (!state) {
      return null
    }
    const targetResolution = this._resolveTargetEndpoint(context, target, fallbackPoint)
    if (!targetResolution.elementId) {
      return null
    }
    const sourcePoint = this._connection.resolveElementPoint(context, state.sourceElementId, targetResolution.point) ?? state.sourcePoint
    const edgeInput: ElementsConnectionEdgeInput = {
      id: `${this._edgeFactory.idPrefix}-${Date.now().toString(36)}-${this._createCounter += 1}`,
      source: {
        elementId: state.sourceElementId,
        portId: state.sourcePortId,
        point: { ...sourcePoint },
      },
      target: targetResolution.endpoint,
      waypoints: [this._connection.midpoint(sourcePoint, targetResolution.point)],
    }
    const element = this._edgeFactory.create(edgeInput)
    const duplicate = this._findDuplicateEdge(context, element)
    if (duplicate) {
      context.applyCommand({ type: 'select', ids: [duplicate.id] })
      this.clear()
      return duplicate
    }
    context.applyCommand({ type: 'element.add', element })
    context.applyCommand({ type: 'select', ids: [element.id] })
    this.clear()
    return element
  }

  clear(): void {
    this._connection.clear()
    this._preview.clear()
  }

  canStart(context: ModelerPluginContext, elementId: string): boolean {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || !this._connection.canStart(context, elementId)) {
      return false
    }
    return this._edgeFactory.canStart?.(context, element) ?? true
  }

  canCompleteElement(context: ModelerPluginContext, elementId: string): boolean {
    const state = this._connection.get()
    if (!state || !this._connection.canCompleteElement(context, elementId)) {
      return false
    }
    const source = context.getModel().elements.find(item => item.id === state.sourceElementId)
    const target = context.getModel().elements.find(item => item.id === elementId)
    if (!source || !target) {
      return false
    }
    return this._edgeFactory.canComplete?.(context, source, target) ?? true
  }

  private _resolveTargetEndpoint(
    context: ModelerPluginContext,
    target: ReturnType<ModelerPluginContext['hitTest']>,
    fallbackPoint: ModelerPoint,
  ): ReturnType<ElementsConnection['resolveTargetEndpoint']> {
    const resolution = this._connection.resolveTargetEndpoint(context, target, fallbackPoint)
    if (!resolution.elementId || this.canCompleteElement(context, resolution.elementId)) {
      return resolution
    }
    return { endpoint: { point: fallbackPoint }, point: fallbackPoint }
  }

  private _findDuplicateEdge(context: ModelerPluginContext, edge: ModelerEdgeElement): ModelerEdgeElement | null {
    const sourceId = edge.source.elementId
    const targetId = edge.target.elementId
    if (!sourceId || !targetId) {
      return null
    }
    return context.getModel().elements.find((element): element is ModelerEdgeElement => {
      return isModelerEdgeElement(element)
        && element.type === edge.type
        && element.source.elementId === sourceId
        && element.target.elementId === targetId
    }) ?? null
  }
}

function isBpmnFlowNode(element: ModelerElement): boolean {
  return element.type === BPMN_EVENT_TYPE
    || element.type === BPMN_BOUNDARY_EVENT_TYPE
    || element.type === BPMN_GATEWAY_TYPE
    || element.type === BPMN_TASK_TYPE
    || element.type === BPMN_SUB_PROCESS_TYPE
    || element.type === BPMN_CALL_ACTIVITY_TYPE
}
