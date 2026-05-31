import type {
  ModelerElement,
  ModelerPluginContext,
  ModelerPoint,
} from '@/domain/types/index'
import { createBpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.factory'
import type { ElementsConnection } from '@/plugins/elements/model/ElementsConnection'
import type { ElementsEdgePreview } from '@/plugins/elements/model/ElementsEdgePreview'

export class ElementsConnectionFlow {
  private createCounter = 0

  constructor(
    private readonly connection: ElementsConnection,
    private readonly preview: ElementsEdgePreview,
  ) {}

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
    const source = this.connection.createEndpointFromElement(context, elementId, referencePoint)
    if (!source) return false
    this.connection.begin({
      origin,
      source: source.endpoint,
      sourceElementId: elementId,
      sourcePortId: source.port.id,
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
    this.connection.update({
      pointerPoint: point,
      targetElementId: targetResolution.elementId,
      targetPortId: targetResolution.portId,
    })
    this.preview.set(createBpmnFlowElement({
      id: 'bpmn-flow-preview',
      source: state.source,
      target: targetResolution.endpoint,
      waypoints: [this.connection.midpoint(state.sourcePoint, targetResolution.point)],
    }))
  }

  completeAtTarget(context: ModelerPluginContext, target: ReturnType<ModelerPluginContext['hitTest']>, fallbackPoint: ModelerPoint): ModelerElement | null {
    const state = this.connection.get()
    if (!state) return null
    const targetResolution = this.connection.resolveTargetEndpoint(context, target, fallbackPoint)
    if (!targetResolution.elementId || !targetResolution.portId) return null
    const element = createBpmnFlowElement({
      id: `bpmn-flow-${Date.now().toString(36)}-${this.createCounter += 1}`,
      source: state.source,
      target: targetResolution.endpoint,
      waypoints: [this.connection.midpoint(state.sourcePoint, targetResolution.point)],
    })
    context.applyCommand({ type: 'element.add', element })
    context.applyCommand({ type: 'select', ids: [element.id] })
    this.clear()
    return element
  }

  clear(): void {
    this.connection.clear()
    this.preview.clear()
  }
}
