import type {
  ProcessEdge,
  ProcessLane,
  ProcessMetadata,
  ProcessModel,
  ProcessModelInput,
  ProcessNode,
  ProcessPool,
  ProcessPortInput,
  ProcessViewport,
} from '@/model/types/process-modeler.types'
import { normalizeProcessPortInput } from '@/model/ports/process-ports'

const DEFAULT_VIEWPORT: ProcessViewport = { x: 0, y: 0, scale: 1 }
const DEFAULT_NODE_SIZE: Record<ProcessNode['kind'], { width: number; height: number }> = {
  startEvent: { width: 42, height: 42 },
  endEvent: { width: 42, height: 42 },
  userTask: { width: 148, height: 76 },
  serviceTask: { width: 148, height: 76 },
  exclusiveGateway: { width: 58, height: 58 },
  parallelGateway: { width: 58, height: 58 },
}

let idCounter = 0

/** Создает стабильный id для новых элементов процесса. */
export function createProcessElementId(prefix = 'process-element'): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

/** Создает нормализованную process-модель из частичного ввода. */
export function createProcessModel(input: ProcessModelInput | ProcessModel = {}): ProcessModel {
  return {
    id: input.id ?? createProcessElementId('process'),
    version: input.version ?? '0.1.0',
    metadata: normalizeMetadata(input.metadata),
    nodes: (input.nodes ?? []).map(normalizeNode),
    edges: (input.edges ?? []).map(normalizeEdge),
    pools: (input.pools ?? []).map(normalizePool),
    selection: unique(input.selection ?? []),
    viewport: normalizeViewport(input.viewport),
    issues: [...(input.issues ?? [])],
  }
}

/** Создает глубокую копию process-модели для undo/redo и публичных snapshot. */
export function cloneProcessModel(model: ProcessModel): ProcessModel {
  return createProcessModel({
    id: model.id,
    version: model.version,
    metadata: cloneMetadata(model.metadata),
    nodes: model.nodes.map(node => ({
      ...node,
      ports: node.ports?.map(port => ({ ...port, metadata: cloneMetadata(port.metadata) })),
      metadata: cloneMetadata(node.metadata),
    })),
    edges: model.edges.map(edge => ({
      ...edge,
      waypoints: edge.waypoints?.map(point => ({ ...point })),
      metadata: cloneMetadata(edge.metadata),
    })),
    pools: model.pools.map(pool => ({
      ...pool,
      metadata: cloneMetadata(pool.metadata),
      lanes: pool.lanes.map(lane => ({ ...lane, metadata: cloneMetadata(lane.metadata) })),
    })),
    selection: [...model.selection],
    viewport: { ...model.viewport },
    issues: model.issues.map(issue => ({ ...issue, details: issue.details ? { ...issue.details } : undefined })),
  })
}

/** Возвращает true, если элемент с таким id есть в модели. */
export function hasProcessElement(model: ProcessModel, id: string): boolean {
  return Boolean(findProcessNode(model, id) || findProcessEdge(model, id) || findProcessLane(model, id) || findProcessPool(model, id))
}

/** Находит node по id. */
export function findProcessNode(model: ProcessModel, id: string): ProcessNode | undefined {
  return model.nodes.find(node => node.id === id)
}

/** Находит edge по id. */
export function findProcessEdge(model: ProcessModel, id: string): ProcessEdge | undefined {
  return model.edges.find(edge => edge.id === id)
}

/** Находит lane по id. */
export function findProcessLane(model: ProcessModel, id: string): ProcessLane | undefined {
  for (const pool of model.pools) {
    const lane = pool.lanes.find(item => item.id === id)
    if (lane) return lane
  }
  return undefined
}

/** Находит pool по id. */
export function findProcessPool(model: ProcessModel, id: string): ProcessPool | undefined {
  return model.pools.find(pool => pool.id === id)
}

/** Нормализует process node и добавляет BPMN-like размеры по умолчанию. */
export function normalizeNode(node: Omit<Partial<ProcessNode>, 'ports'> & Pick<ProcessNode, 'id' | 'kind'> & { ports?: ProcessPortInput }): ProcessNode {
  const size = DEFAULT_NODE_SIZE[node.kind]
  return {
    id: node.id,
    kind: node.kind,
    x: finiteNumber(node.x, 0),
    y: finiteNumber(node.y, 0),
    width: finiteNumber(node.width, size.width),
    height: finiteNumber(node.height, size.height),
    laneId: node.laneId,
    ports: normalizeProcessPortInput(node.ports, node.kind),
    metadata: normalizeMetadata(node.metadata),
  }
}

/** Нормализует sequence flow. */
export function normalizeEdge(edge: Partial<ProcessEdge> & Pick<ProcessEdge, 'id' | 'sourceId' | 'targetId'>): ProcessEdge {
  return {
    id: edge.id,
    kind: 'sequenceFlow',
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    sourcePortId: edge.sourcePortId,
    targetPortId: edge.targetPortId,
    waypoints: edge.waypoints?.map(point => ({ x: finiteNumber(point.x, 0), y: finiteNumber(point.y, 0) })),
    metadata: normalizeMetadata(edge.metadata),
  }
}

/** Нормализует pool вместе с lanes. */
export function normalizePool(pool: Partial<ProcessPool> & Pick<ProcessPool, 'id'>): ProcessPool {
  return {
    id: pool.id,
    kind: 'pool',
    x: finiteNumber(pool.x, 0),
    y: finiteNumber(pool.y, 0),
    width: finiteNumber(pool.width, 860),
    height: finiteNumber(pool.height, 280),
    metadata: normalizeMetadata(pool.metadata),
    lanes: (pool.lanes ?? []).map(normalizeLane),
  }
}

/** Нормализует lane. */
export function normalizeLane(lane: Partial<ProcessLane> & Pick<ProcessLane, 'id'>): ProcessLane {
  return {
    id: lane.id,
    kind: 'lane',
    x: finiteNumber(lane.x, 0),
    y: finiteNumber(lane.y, 0),
    width: finiteNumber(lane.width, 860),
    height: finiteNumber(lane.height, 140),
    metadata: normalizeMetadata(lane.metadata),
  }
}

/** Нормализует metadata без сохранения undefined-полей. */
export function normalizeMetadata(metadata: ProcessMetadata = {}): ProcessMetadata {
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

/** Нормализует viewport и защищает scale от нуля. */
export function normalizeViewport(viewport: Partial<ProcessViewport> | undefined): ProcessViewport {
  return {
    x: finiteNumber(viewport?.x, DEFAULT_VIEWPORT.x),
    y: finiteNumber(viewport?.y, DEFAULT_VIEWPORT.y),
    scale: Math.max(0.1, Math.min(4, finiteNumber(viewport?.scale, DEFAULT_VIEWPORT.scale))),
  }
}

function cloneMetadata(metadata: ProcessMetadata): ProcessMetadata {
  return normalizeMetadata(metadata)
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

function unique(values: Array<string>): Array<string> {
  return Array.from(new Set(values))
}
