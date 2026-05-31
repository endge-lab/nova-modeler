import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElement,
  ModelerElementInput,
  ModelerPluginContext,
  ModelerPoint,
} from '@/domain/types/index'
import { createBpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.factory'
import type { ElementsConnection } from '@/plugins/elements/model/ElementsConnection'
import type { ElementsEdgePreview } from '@/plugins/elements/model/ElementsEdgePreview'

export interface ElementsConnectionEdgeFactory {
  idPrefix: string
  previewId: string
  create(input: ElementsConnectionEdgeInput): ModelerEdgeElement
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
}

export class ElementsConnectionFlow {
  private createCounter = 0
  private edgeFactory = DEFAULT_EDGE_FACTORY

  constructor(
    private readonly connection: ElementsConnection,
    private readonly preview: ElementsEdgePreview,
  ) {}

  useDefaultEdgeFactory(): void {
    this.edgeFactory = DEFAULT_EDGE_FACTORY
  }

  useEdgeFactory(factory: ElementsConnectionEdgeFactory): void {
    this.edgeFactory = factory
  }

  beginFromPort(
    context: ModelerPluginContext,
    elementId: string,
    portId: string,
    origin: 'port-drag' | 'tool' | 'context-pad',
  ): boolean {
    const point = this.connection.resolvePortPoint(context, elementId, portId)
    if (!point || !this.connection.canStart(context, elementId)) return false
    this.connection.begin({
      origin,
      source: this.connection.createEndpoint(elementId, portId, point),
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
    if (!this.connection.canStart(context, elementId)) return false
    const source = this.connection.createEndpointFromElement(context, elementId, referencePoint)
    if (!source) return false
    this.connection.begin({
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
    const state = this.connection.get()
    if (!state) return
    const resolvedTarget = target ?? context.hitTest(context.worldToScreen(point))
    const targetResolution = this.connection.resolveTargetEndpoint(context, resolvedTarget, point)
    const sourcePoint = this.connection.resolveElementPoint(context, state.sourceElementId, targetResolution.point) ?? state.sourcePoint
    const source = {
      elementId: state.sourceElementId,
      portId: state.sourcePortId,
      point: { ...sourcePoint },
    }
    this.connection.update({
      source,
      sourcePoint,
      pointerPoint: point,
      targetElementId: targetResolution.elementId,
      targetPortId: targetResolution.portId,
    })
    const edgeInput: ElementsConnectionEdgeInput = {
      id: this.edgeFactory.previewId,
      source,
      target: targetResolution.endpoint,
      waypoints: [this.connection.midpoint(sourcePoint, targetResolution.point)],
    }
    this.preview.set(this.edgeFactory.create(edgeInput))
  }

  completeAtTarget(context: ModelerPluginContext, target: ReturnType<ModelerPluginContext['hitTest']>, fallbackPoint: ModelerPoint): ModelerElement | null {
    const state = this.connection.get()
    if (!state) return null
    const targetResolution = this.connection.resolveTargetEndpoint(context, target, fallbackPoint)
    if (!targetResolution.elementId) return null
    const sourcePoint = this.connection.resolveElementPoint(context, state.sourceElementId, targetResolution.point) ?? state.sourcePoint
    const edgeInput: ElementsConnectionEdgeInput = {
      id: `${this.edgeFactory.idPrefix}-${Date.now().toString(36)}-${this.createCounter += 1}`,
      source: {
        elementId: state.sourceElementId,
        portId: state.sourcePortId,
        point: { ...sourcePoint },
      },
      target: targetResolution.endpoint,
      waypoints: [this.connection.midpoint(sourcePoint, targetResolution.point)],
    }
    const element = this.edgeFactory.create(edgeInput)
    context.applyCommand({ type: 'element.add', element })
    context.applyCommand({ type: 'select', ids: [element.id] })
    this.clear()
    return element
  }

  clear(): void {
    this.connection.clear()
    this.preview.clear()
    this.useDefaultEdgeFactory()
  }
}
