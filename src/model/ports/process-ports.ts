import type {
  ProcessEdge,
  ProcessEdgeKind,
  ProcessMetadata,
  ProcessNode,
  ProcessNodeKind,
  ProcessPortDefinition,
  ProcessPortInput,
  ProcessResolvedPort,
  ProcessRect,
} from '@/model/types/process-modeler.types'

const DEFAULT_PORT_CAPACITY: ProcessPortDefinition['capacity'] = 'unlimited'
const DEFAULT_EDGE_KIND: ProcessEdgeKind = 'sequenceFlow'
const PORT_HIT_SIZE = 14

const BUILTIN_PORTS: Record<ProcessNodeKind, Array<Omit<ProcessPortDefinition, 'metadata'>>> = {
  startEvent: [{ id: 'out', direction: 'output', side: 'right', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, emits: [DEFAULT_EDGE_KIND] }],
  endEvent: [{ id: 'in', direction: 'input', side: 'left', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, accepts: [DEFAULT_EDGE_KIND] }],
  userTask: [
    { id: 'in', direction: 'input', side: 'left', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, accepts: [DEFAULT_EDGE_KIND] },
    { id: 'out', direction: 'output', side: 'right', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, emits: [DEFAULT_EDGE_KIND] },
  ],
  serviceTask: [
    { id: 'in', direction: 'input', side: 'left', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, accepts: [DEFAULT_EDGE_KIND] },
    { id: 'out', direction: 'output', side: 'right', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, emits: [DEFAULT_EDGE_KIND] },
  ],
  exclusiveGateway: [
    { id: 'in', direction: 'input', side: 'left', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, accepts: [DEFAULT_EDGE_KIND] },
    { id: 'out', direction: 'output', side: 'right', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, emits: [DEFAULT_EDGE_KIND] },
  ],
  parallelGateway: [
    { id: 'in', direction: 'input', side: 'left', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, accepts: [DEFAULT_EDGE_KIND] },
    { id: 'out', direction: 'output', side: 'right', align: 0.5, offset: 0, enabled: true, capacity: DEFAULT_PORT_CAPACITY, emits: [DEFAULT_EDGE_KIND] },
  ],
}

/** Возвращает default connection ports для встроенного process element kind. */
export function getDefaultProcessPorts(kind: ProcessNodeKind): Array<ProcessPortDefinition> {
  return BUILTIN_PORTS[kind].map(port => normalizeProcessPortDefinition(port))
}

/** Нормализует node-level port override. */
export function normalizeProcessPortInput(input: ProcessPortInput | undefined, kind: ProcessNodeKind): Array<ProcessPortDefinition> | undefined {
  if (input === undefined) return undefined
  if (input === false) return []
  return input.map(port => normalizeProcessPortDefinition(port, kind))
}

/** Нормализует один порт и добавляет безопасные defaults. */
export function normalizeProcessPortDefinition(
  port: Partial<ProcessPortDefinition> & Pick<ProcessPortDefinition, 'id' | 'direction' | 'side'>,
  _kind?: ProcessNodeKind,
): ProcessPortDefinition {
  return {
    id: port.id,
    direction: port.direction,
    side: port.side,
    align: clamp01(port.align ?? 0.5),
    offset: finiteNumber(port.offset, 0),
    enabled: port.enabled ?? true,
    capacity: port.capacity ?? DEFAULT_PORT_CAPACITY,
    ...(port.accepts !== undefined ? { accepts: [...port.accepts] } : {}),
    ...(port.emits !== undefined ? { emits: [...port.emits] } : {}),
    metadata: normalizePortMetadata(port.metadata),
  }
}

/** Возвращает ports node override или builtin defaults. */
export function resolveProcessNodePortDefinitions(node: Pick<ProcessNode, 'kind' | 'ports'>): Array<ProcessPortDefinition> {
  return node.ports !== undefined ? node.ports.map(port => normalizeProcessPortDefinition(port)) : getDefaultProcessPorts(node.kind)
}

/** Возвращает default port для направления связи. */
export function getDefaultProcessPort(node: Pick<ProcessNode, 'kind' | 'ports'>, direction: 'input' | 'output'): ProcessPortDefinition | undefined {
  return resolveProcessNodePortDefinitions(node).find(port => canUseProcessPortForDirection(port, direction))
}

/** Проверяет, может ли port участвовать в связи в указанном направлении. */
export function canUseProcessPortForDirection(port: ProcessPortDefinition, direction: 'input' | 'output', edgeKind: ProcessEdgeKind = DEFAULT_EDGE_KIND): boolean {
  if (!port.enabled) return false
  if (direction === 'input' && port.direction !== 'input' && port.direction !== 'bidirectional') return false
  if (direction === 'output' && port.direction !== 'output' && port.direction !== 'bidirectional') return false
  if (direction === 'input' && port.accepts && !port.accepts.includes(edgeKind)) return false
  if (direction === 'output' && port.emits && !port.emits.includes(edgeKind)) return false
  return true
}

/** Проверяет совместимость исходящего и входящего портов. */
export function areProcessPortsCompatible(source: ProcessPortDefinition, target: ProcessPortDefinition, edgeKind: ProcessEdgeKind = DEFAULT_EDGE_KIND): boolean {
  return canUseProcessPortForDirection(source, 'output', edgeKind) && canUseProcessPortForDirection(target, 'input', edgeKind)
}

/** Находит port definition на node. */
export function findProcessNodePort(node: Pick<ProcessNode, 'kind' | 'ports'>, portId: string | undefined, direction: 'input' | 'output'): ProcessPortDefinition | undefined {
  const ports = resolveProcessNodePortDefinitions(node)
  if (!portId) return ports.find(port => canUseProcessPortForDirection(port, direction))
  return ports.find(port => port.id === portId)
}

/** Возвращает effective port ids для legacy и port-aware edges. */
export function resolveProcessEdgePortIds(source: ProcessNode, target: ProcessNode, edge: Pick<ProcessEdge, 'sourcePortId' | 'targetPortId'>): { sourcePortId?: string; targetPortId?: string } {
  return {
    sourcePortId: edge.sourcePortId ?? getDefaultProcessPort(source, 'output')?.id,
    targetPortId: edge.targetPortId ?? getDefaultProcessPort(target, 'input')?.id,
  }
}

/** Создает экранные и world-координаты портов для layout. */
export function resolveProcessNodePorts(
  node: ProcessNode,
  screenRect: ProcessRect,
  edges: Array<ProcessEdge>,
  viewportScale: number,
  connectionCounts?: Map<string, number>,
): Array<ProcessResolvedPort> {
  const definitions = resolveProcessNodePortDefinitions(node)
  return definitions.map(port => {
    const screenPoint = pointOnRect(screenRect, port)
    const worldPoint = pointOnRect(node, port)
    return {
      ...port,
      nodeId: node.id,
      x: screenPoint.x,
      y: screenPoint.y,
      worldX: worldPoint.x,
      worldY: worldPoint.y,
      bounds: {
        x: screenPoint.x - PORT_HIT_SIZE / 2,
        y: screenPoint.y - PORT_HIT_SIZE / 2,
        width: PORT_HIT_SIZE,
        height: PORT_HIT_SIZE,
      },
      connectionCount: connectionCounts?.get(`${node.id}:${port.id}`) ?? countPortConnections(node, port, edges),
    }
  }).map(port => ({
    ...port,
    bounds: {
      x: port.x - (PORT_HIT_SIZE * Math.max(1, viewportScale)) / 2,
      y: port.y - (PORT_HIT_SIZE * Math.max(1, viewportScale)) / 2,
      width: PORT_HIT_SIZE * Math.max(1, viewportScale),
      height: PORT_HIT_SIZE * Math.max(1, viewportScale),
    },
  }))
}

/** Возвращает true, если port capacity уже исчерпана. */
export function isProcessPortCapacityExceeded(port: ProcessPortDefinition, connectionCount: number): boolean {
  return typeof port.capacity === 'number' && connectionCount > port.capacity
}

function countPortConnections(node: ProcessNode, port: ProcessPortDefinition, edges: Array<ProcessEdge>): number {
  let count = 0
  for (const edge of edges) {
    if (edge.sourceId === node.id && (edge.sourcePortId ?? getDefaultProcessPort(node, 'output')?.id) === port.id) count += 1
    if (edge.targetId === node.id && (edge.targetPortId ?? getDefaultProcessPort(node, 'input')?.id) === port.id) count += 1
  }
  return count
}

function pointOnRect(rect: ProcessRect, port: ProcessPortDefinition): { x: number; y: number } {
  const align = clamp01(port.align)
  if (port.side === 'left') return { x: rect.x + port.offset, y: rect.y + rect.height * align }
  if (port.side === 'right') return { x: rect.x + rect.width + port.offset, y: rect.y + rect.height * align }
  if (port.side === 'top') return { x: rect.x + rect.width * align, y: rect.y + port.offset }
  return { x: rect.x + rect.width * align, y: rect.y + rect.height + port.offset }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.max(0, Math.min(1, value))
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

function normalizePortMetadata(metadata: ProcessMetadata = {}): ProcessMetadata {
  return {
    ...(metadata.name !== undefined ? { name: metadata.name } : {}),
    ...(metadata.description !== undefined ? { description: metadata.description } : {}),
    ...(metadata.formId !== undefined ? { formId: metadata.formId } : {}),
    ...(metadata.actionId !== undefined ? { actionId: metadata.actionId } : {}),
    ...(metadata.assignee !== undefined ? { assignee: metadata.assignee } : {}),
    ...(metadata.condition !== undefined ? { condition: metadata.condition } : {}),
    ...(metadata.tags !== undefined ? { tags: [...metadata.tags] } : {}),
    ...(metadata.custom !== undefined ? { custom: { ...metadata.custom } } : {}),
  }
}
