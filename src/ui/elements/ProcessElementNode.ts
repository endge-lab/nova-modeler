import {
  NovaNode,
  type NovaApp,
  type NovaSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import {
  PROCESS_MODELER_ASSETS,
  resolveProcessModelerNodeIconName,
} from '@/assets/process-modeler-assets'
import {
  canUseProcessPortForDirection,
  resolveProcessNodePorts,
} from '@/model/ports/process-ports'
import type {
  ProcessEdge,
  ProcessModelerNodeLayout,
  ProcessNode,
  ProcessNodeKind,
  ProcessResolvedPort,
} from '@/model/types/process-modeler.types'

export interface ProcessElementRenderState {
  portsVisible: boolean
  activePortId?: string
  hoveredPortId?: string
  validPortIds?: Set<string>
}

/** Базовая NovaNode для визуального process element с connection ports. */
export abstract class ProcessElementNode<E extends EventList = Record<string, any>> extends NovaNode<E> {
  /** Рендерит сам визуальный элемент без портов. */
  abstract renderElement(schema: NovaSchema, node: ProcessModelerNodeLayout): void

  /** Возвращает resolved ports для node. */
  resolvePorts(node: ProcessNode, screenRect: ProcessModelerNodeLayout, edges: Array<ProcessEdge>, scale: number): Array<ProcessResolvedPort> {
    return resolveProcessNodePorts(node, screenRect, edges, scale)
  }

  /** Рендерит ports поверх элемента. */
  renderPorts(schema: NovaSchema, ports: Array<ProcessResolvedPort>, state: ProcessElementRenderState): void {
    if (!state.portsVisible) return
    for (const port of ports) {
      const key = `${port.nodeId}:${port.id}`
      const hovered = state.hoveredPortId === key
      const active = state.activePortId === key
      const valid = state.validPortIds?.has(key) ?? true
      const fill = active ? '#1d4ed8' : hovered ? '#2563eb' : valid ? '#ffffff' : '#e5e7eb'
      const stroke = active || hovered ? '#1d4ed8' : valid ? '#2563eb' : '#98a2b3'
      schema.push({
        type: 'circle',
        x: port.x,
        y: port.y,
        radius: hovered || active ? 5 : 4,
        styles: {
          background: fill,
          border: { color: stroke, width: 2 },
        },
        meta: {
          processElementType: 'port',
          nodeId: port.nodeId,
          portId: port.id,
          direction: port.direction,
        },
      })
    }
  }

  /** Проверяет, можно ли начать связь из port. */
  canStartConnection(port: ProcessResolvedPort): boolean {
    return canUseProcessPortForDirection(port, 'output')
  }

  /** Проверяет, может ли port принять связь. */
  canAcceptConnection(port: ProcessResolvedPort): boolean {
    return canUseProcessPortForDirection(port, 'input')
  }

  /** Возвращает default port из списка resolved ports. */
  getDefaultPort(ports: Array<ProcessResolvedPort>, direction: 'input' | 'output'): ProcessResolvedPort | undefined {
    return ports.find(port => canUseProcessPortForDirection(port, direction))
  }

  protected pushNodeIcon(schema: NovaSchema, kind: ProcessNodeKind, x: number, y: number, size: number, tone: 'dark' | 'light' = 'dark'): void {
    const icon = PROCESS_MODELER_ASSETS.icons[resolveProcessModelerNodeIconName(kind, tone)]
    schema.push({
      type: 'icon',
      icon,
      x,
      y,
      width: size,
      height: size,
      styles: { quality: 'crisp' },
    })
  }

  protected pushRect(schema: NovaSchema, x: number, y: number, width: number, height: number, background: string, radius = 0, borderColor?: string, borderWidth = 1): void {
    schema.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      styles: {
        background,
        radius,
        ...(borderColor ? { border: { color: borderColor, width: borderWidth, radius } } : {}),
      },
    })
  }

  protected pushText(schema: NovaSchema, text: string, x: number, y: number, width: number, height: number, color: string, size: number, weight: '600' | '700' | '800' | '900', align: 'left' | 'center' = 'left'): void {
    schema.push({
      type: 'text',
      text,
      x,
      y,
      width,
      height,
      styles: {
        color,
        font: { size, weight, family: 'Avenir Next, ui-sans-serif, system-ui' },
        ellipsis: true,
        align: { horizontal: align, vertical: 'middle' },
      },
    })
  }
}

/** Визуальный event element. */
export class ProcessEventElementNode<E extends EventList = Record<string, any>> extends ProcessElementNode<E> {
  /** Рендерит BPMN-like event circle. */
  renderElement(schema: NovaSchema, node: ProcessModelerNodeLayout): void {
    const stroke = node.invalid ? '#f97316' : node.selected ? '#2563eb' : '#8ea3b8'
    const fill = node.selected ? '#eff6ff' : '#ffffff'
    schema.push({ type: 'circle', x: node.x + node.width / 2, y: node.y + node.height / 2, radius: node.width / 2, styles: { background: fill, border: { color: stroke, width: node.kind === 'endEvent' ? 3 : 2 } } })
    this.pushText(schema, node.label, node.x + 10, node.y + node.height / 2 - 9, node.width - 20, 18, '#182230', 12, '800', 'center')
  }
}

/** Визуальный task element. */
export class ProcessTaskElementNode<E extends EventList = Record<string, any>> extends ProcessElementNode<E> {
  /** Рендерит task rectangle. */
  renderElement(schema: NovaSchema, node: ProcessModelerNodeLayout): void {
    const stroke = node.invalid ? '#f97316' : node.selected ? '#2563eb' : '#8ea3b8'
    const fill = node.selected ? '#eff6ff' : '#ffffff'
    this.pushRect(schema, node.x, node.y, node.width, node.height, fill, 8, stroke, 2)
    this.pushNodeIcon(schema, node.kind, node.x + 10, node.y + 10, 16)
    this.pushText(schema, node.label, node.x + 10, node.y + node.height / 2 - 9, node.width - 20, 18, '#182230', 12, '800', 'center')
  }
}

/** Визуальный gateway element. */
export class ProcessGatewayElementNode<E extends EventList = Record<string, any>> extends ProcessElementNode<E> {
  /** Рендерит gateway diamond. */
  renderElement(schema: NovaSchema, node: ProcessModelerNodeLayout): void {
    const stroke = node.invalid ? '#f97316' : node.selected ? '#2563eb' : '#8ea3b8'
    const fill = node.selected ? '#eff6ff' : '#ffffff'
    schema.push({ type: 'polygon', points: [{ x: node.x + node.width / 2, y: node.y }, { x: node.x + node.width, y: node.y + node.height / 2 }, { x: node.x + node.width / 2, y: node.y + node.height }, { x: node.x, y: node.y + node.height / 2 }], styles: { background: fill, stroke, lineWidth: 2 } })
    this.pushNodeIcon(schema, node.kind, node.x + node.width / 2 - 10, node.y + node.height / 2 - 10, 20)
  }
}

/** Создает builtin element node для kind. */
export function createBuiltinProcessElementNode<E extends EventList = Record<string, any>>(kind: ProcessNodeKind, app: NovaApp<E>, surface: NovaSurface<E>): ProcessElementNode<E> {
  if (kind === 'startEvent' || kind === 'endEvent') return new ProcessEventElementNode(app, surface)
  if (kind === 'exclusiveGateway' || kind === 'parallelGateway') return new ProcessGatewayElementNode(app, surface)
  return new ProcessTaskElementNode(app, surface)
}
