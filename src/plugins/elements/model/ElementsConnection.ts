import type {
  ModelerEdgeEndpoint,
  ModelerElement,
  ModelerPluginContext,
  ModelerPoint,
  ModelerPort,
} from '@/domain/types/index'
import type { ConnectionAnchorResolver } from '@/plugins/elements/model/ConnectionAnchorResolver'
import type { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'
import type { ElementsPorts } from '@/plugins/elements/model/ElementsPorts'
import { isModelerEdgeElement } from '@/domain/types/index'

export interface ElementsConnectionState {
  origin: 'port-drag' | 'tool' | 'context-pad'
  source: ModelerEdgeEndpoint
  sourceElementId: string
  sourcePortId?: string
  sourcePoint: ModelerPoint
  pointerPoint: ModelerPoint
  targetElementId?: string
  targetPortId?: string
}

export interface ElementsAvailableConnectionPort extends ModelerPort {
  highlighted: boolean
}

export class ElementsConnection {
  private _state: ElementsConnectionState | null = null
  private readonly _listeners = new Set<() => void>()

  constructor(
    private readonly _geometry: ElementsGeometry,
    private readonly _ports: ElementsPorts,
    private readonly _anchors: ConnectionAnchorResolver,
  ) {}

  begin(state: ElementsConnectionState): void {
    this._state = cloneState(state)
    this._notify()
  }

  update(patch: Partial<ElementsConnectionState>): void {
    if (!this._state) {
      return
    }
    this._state = cloneState({ ...this._state, ...patch })
    this._notify()
  }

  get(): ElementsConnectionState | null {
    return this._state ? cloneState(this._state) : null
  }

  clear(): void {
    if (!this._state) {
      return
    }
    this._state = null
    this._notify()
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  createEndpoint(elementId: string, portId: string, point: ModelerPoint): ModelerEdgeEndpoint {
    return {
      elementId,
      portId,
      point: { ...point },
    }
  }

  createEndpointFromElement(
    context: ModelerPluginContext,
    elementId: string,
    referencePoint?: ModelerPoint,
  ): { endpoint: ModelerEdgeEndpoint, point: ModelerPoint, port?: ModelerPort } | null {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element) {
      return null
    }
    if (this._anchors.isVirtualAnchorElement(element)) {
      const point = this._anchors.resolveElementAnchor(element, referencePoint)
      return {
        endpoint: {
          elementId,
          point: { ...point },
        },
        point,
      }
    }
    const ports = this._getElementPorts(context, element)
    if (ports.length === 0) {
      return null
    }
    const port = referencePoint
      ? this._nearestPort(ports, referencePoint)
      : ports.find(item => item.id === 'right') ?? ports[0]!
    return {
      endpoint: this.createEndpoint(elementId, port.id, port),
      point: { x: port.x, y: port.y },
      port,
    }
  }

  resolveElementPoint(context: ModelerPluginContext, elementId: string, referencePoint?: ModelerPoint): ModelerPoint | null {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element) {
      return null
    }
    return this._anchors.isVirtualAnchorElement(element)
      ? this._anchors.resolveElementAnchor(element, referencePoint)
      : this.createEndpointFromElement(context, elementId, referencePoint)?.point ?? null
  }

  resolvePortPoint(context: ModelerPluginContext, elementId: string, portId: string): ModelerPoint | null {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element) {
      return null
    }
    const port = this._getElementPorts(context, element).find(item => item.id === portId)
    return port ? { x: port.x, y: port.y } : null
  }

  resolveTargetEndpoint(
    context: ModelerPluginContext,
    target: { type: string, elementId?: string, portId?: string, id?: string },
    fallbackPoint: ModelerPoint,
  ): { endpoint: ModelerEdgeEndpoint, point: ModelerPoint, elementId?: string, portId?: string } {
    const state = this._state
    if (!state) {
      return { endpoint: { point: fallbackPoint }, point: fallbackPoint }
    }
    if (target.type === 'port' && target.elementId && target.portId && this.canComplete(context, target.elementId, target.portId)) {
      const portPoint = this.resolvePortPoint(context, target.elementId, target.portId) ?? fallbackPoint
      return {
        endpoint: this.createEndpoint(target.elementId, target.portId, portPoint),
        point: portPoint,
        elementId: target.elementId,
        portId: target.portId,
      }
    }
    if (target.type === 'element' && target.id && this.canCompleteElement(context, target.id)) {
      const endpoint = this.createEndpointFromElement(context, target.id, state.sourcePoint)
      if (endpoint) {
        return {
          endpoint: endpoint.endpoint,
          point: endpoint.point,
          elementId: target.id,
          portId: endpoint.port?.id,
        }
      }
    }
    return { endpoint: { point: fallbackPoint }, point: fallbackPoint }
  }

  getAvailableTargetPorts(context: ModelerPluginContext): Array<ElementsAvailableConnectionPort> {
    if (!this._state) {
      return []
    }
    const result: Array<ElementsAvailableConnectionPort> = []
    for (const element of context.getModel().elements) {
      if (isModelerEdgeElement(element)) {
        continue
      }
      if (!this.canCompleteElement(context, element.id)) {
        continue
      }
      for (const port of this._getElementPorts(context, element)) {
        if (!this.canComplete(context, element.id, port.id)) {
          continue
        }
        result.push({
          ...port,
          highlighted: this._state.targetElementId === element.id && this._state.targetPortId === port.id,
        })
      }
    }
    return result
  }

  canStart(context: ModelerPluginContext, elementId: string): boolean {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || isModelerEdgeElement(element)) {
      return false
    }
    const definition = element ? context.getElementRegistry().get(element.type) : undefined
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.outgoing !== false
  }

  canComplete(context: ModelerPluginContext, elementId: string, portId: string): boolean {
    if (!this._state) {
      return false
    }
    if (this._state.sourceElementId === elementId) {
      return false
    }
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || isModelerEdgeElement(element)) {
      return false
    }
    const definition = element ? context.getElementRegistry().get(element.type) : undefined
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.incoming !== false
      && this._getElementPorts(context, element).some(port => port.id === portId)
  }

  canCompleteElement(context: ModelerPluginContext, elementId: string): boolean {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || isModelerEdgeElement(element)) {
      return false
    }
    if (this._state?.sourceElementId === elementId) {
      return false
    }
    const definition = context.getElementRegistry().get(element.type)
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.incoming !== false
      && (this._anchors.isVirtualAnchorElement(element) || this._getElementPorts(context, element).length > 0)
  }

  midpoint(a: ModelerPoint, b: ModelerPoint): ModelerPoint {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    }
  }

  private _getElementPorts(context: ModelerPluginContext, element: ModelerElement): Array<ModelerPort> {
    const definition = context.getElementRegistry().get(element.type)
    if (!definition) {
      return []
    }
    return this._ports.createElementPorts(element, definition.getPorts?.(context, element) ?? [])
  }

  private _nearestPort(ports: Array<ModelerPort>, point: ModelerPoint): ModelerPort {
    return ports.reduce((best, port) => this._geometry.distance(port, point) < this._geometry.distance(best, point) ? port : best, ports[0]!)
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }
}

function cloneState(state: ElementsConnectionState): ElementsConnectionState {
  return {
    ...state,
    source: {
      ...state.source,
      point: state.source.point ? { ...state.source.point } : undefined,
    },
    sourcePoint: { ...state.sourcePoint },
    pointerPoint: { ...state.pointerPoint },
  }
}
