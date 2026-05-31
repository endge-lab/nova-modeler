import type {
  ModelerEdgeEndpoint,
  ModelerElement,
  ModelerPluginContext,
  ModelerPoint,
  ModelerPort,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import type { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'
import type { ElementsPorts } from '@/plugins/elements/model/ElementsPorts'

export interface ElementsConnectionState {
  origin: 'port-drag' | 'tool' | 'context-pad'
  source: ModelerEdgeEndpoint
  sourceElementId: string
  sourcePortId: string
  sourcePoint: ModelerPoint
  pointerPoint: ModelerPoint
  targetElementId?: string
  targetPortId?: string
}

export interface ElementsAvailableConnectionPort extends ModelerPort {
  highlighted: boolean
}

export class ElementsConnection {
  private state: ElementsConnectionState | null = null
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly geometry: ElementsGeometry,
    private readonly ports: ElementsPorts,
  ) {}

  begin(state: ElementsConnectionState): void {
    this.state = cloneState(state)
    this.notify()
  }

  update(patch: Partial<ElementsConnectionState>): void {
    if (!this.state) return
    this.state = cloneState({ ...this.state, ...patch })
    this.notify()
  }

  get(): ElementsConnectionState | null {
    return this.state ? cloneState(this.state) : null
  }

  clear(): void {
    if (!this.state) return
    this.state = null
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
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
  ): { endpoint: ModelerEdgeEndpoint; point: ModelerPoint; port: ModelerPort } | null {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || !this.canStart(context, elementId)) return null
    const ports = this.getElementPorts(context, element)
    if (ports.length === 0) return null
    const port = referencePoint
      ? this.nearestPort(ports, referencePoint)
      : ports.find(item => item.id === 'right') ?? ports[0]!
    return {
      endpoint: this.createEndpoint(elementId, port.id, port),
      point: { x: port.x, y: port.y },
      port,
    }
  }

  resolvePortPoint(context: ModelerPluginContext, elementId: string, portId: string): ModelerPoint | null {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element) return null
    const port = this.getElementPorts(context, element).find(item => item.id === portId)
    return port ? { x: port.x, y: port.y } : null
  }

  resolveTargetEndpoint(
    context: ModelerPluginContext,
    target: { type: string; elementId?: string; portId?: string; id?: string },
    fallbackPoint: ModelerPoint,
  ): { endpoint: ModelerEdgeEndpoint; point: ModelerPoint; elementId?: string; portId?: string } {
    const state = this.state
    if (!state) return { endpoint: { point: fallbackPoint }, point: fallbackPoint }
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
          portId: endpoint.port.id,
        }
      }
    }
    return { endpoint: { point: fallbackPoint }, point: fallbackPoint }
  }

  getAvailableTargetPorts(context: ModelerPluginContext): Array<ElementsAvailableConnectionPort> {
    if (!this.state) return []
    const result: Array<ElementsAvailableConnectionPort> = []
    for (const element of context.getModel().elements) {
      if (isModelerEdgeElement(element)) continue
      if (!this.canCompleteElement(context, element.id)) continue
      for (const port of this.getElementPorts(context, element)) {
        if (!this.canComplete(context, element.id, port.id)) continue
        result.push({
          ...port,
          highlighted: this.state.targetElementId === element.id && this.state.targetPortId === port.id,
        })
      }
    }
    return result
  }

  canStart(context: ModelerPluginContext, elementId: string): boolean {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || isModelerEdgeElement(element)) return false
    const definition = element ? context.getElementRegistry().get(element.type) : undefined
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.outgoing !== false
  }

  canComplete(context: ModelerPluginContext, elementId: string, portId: string): boolean {
    if (!this.state) return false
    if (this.state.sourceElementId === elementId) return false
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || isModelerEdgeElement(element)) return false
    const definition = element ? context.getElementRegistry().get(element.type) : undefined
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.incoming !== false
      && this.getElementPorts(context, element).some(port => port.id === portId)
  }

  canCompleteElement(context: ModelerPluginContext, elementId: string): boolean {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || isModelerEdgeElement(element)) return false
    if (this.state?.sourceElementId === elementId) return false
    const definition = context.getElementRegistry().get(element.type)
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.incoming !== false
      && this.getElementPorts(context, element).length > 0
  }

  midpoint(a: ModelerPoint, b: ModelerPoint): ModelerPoint {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    }
  }

  private getElementPorts(context: ModelerPluginContext, element: ModelerElement): Array<ModelerPort> {
    const definition = context.getElementRegistry().get(element.type)
    if (!definition) return []
    return this.ports.createElementPorts(element, definition.getPorts?.(context, element) ?? [])
  }

  private nearestPort(ports: Array<ModelerPort>, point: ModelerPoint): ModelerPort {
    return ports.reduce((best, port) => this.geometry.distance(port, point) < this.geometry.distance(best, point) ? port : best, ports[0]!)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
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
