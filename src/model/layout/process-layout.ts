import type {
  ProcessEdge,
  ProcessModel,
  ProcessModelerEdgeLayout,
  ProcessModelerHitTarget,
  ProcessModelerLayout,
  ProcessModelerLayoutOptions,
  ProcessModelerNodeLayout,
  ProcessPoint,
  ProcessRect,
} from '@/model/types/process-modeler.types'
import {
  resolveProcessEdgePortIds,
  resolveProcessNodePortDefinitions,
  resolveProcessNodePorts,
} from '@/model/ports/process-ports'
import { validateProcessModel } from '@/model/validation/process-validation'

const DEFAULT_PALETTE_WIDTH = 188
const DEFAULT_INSPECTOR_WIDTH = 252
const DEFAULT_PANEL_PADDING = 12
const EDGE_HIT_TOLERANCE = 8

/** Создает layout plan для ProcessModeler root. */
export function createProcessModelerLayout(model: ProcessModel, options: ProcessModelerLayoutOptions): ProcessModelerLayout {
  const paletteWidth = options.paletteWidth ?? DEFAULT_PALETTE_WIDTH
  const inspectorWidth = options.inspectorWidth ?? DEFAULT_INSPECTOR_WIDTH
  const panelPadding = options.panelPadding ?? DEFAULT_PANEL_PADDING
  const validationHeight = 96
  const canvas: ProcessRect = {
    x: paletteWidth,
    y: 0,
    width: Math.max(0, options.width - paletteWidth - inspectorWidth),
    height: options.height,
  }
  const invalidIds = new Set(validateProcessModel(model).map(issue => issue.elementId).filter(Boolean))
  const nodes = model.nodes.map(node => ({
    id: node.id,
    kind: node.kind,
    x: canvas.x + panelPadding + model.viewport.x + node.x * model.viewport.scale,
    y: canvas.y + panelPadding + model.viewport.y + node.y * model.viewport.scale,
    width: node.width * model.viewport.scale,
    height: node.height * model.viewport.scale,
    selected: model.selection.includes(node.id),
    invalid: invalidIds.has(node.id),
    label: node.metadata.name ?? defaultNodeLabel(node.kind),
  }))
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const modelNodesById = new Map(model.nodes.map(node => [node.id, node]))
  const portConnectionCounts = createPortConnectionCounts(model)
  const ports = model.nodes.flatMap((node, index) => resolveProcessNodePorts(node, nodes[index]!, model.edges, model.viewport.scale, portConnectionCounts))
  const portsByNodeAndId = new Map(ports.map(port => [`${port.nodeId}:${port.id}`, port]))
  const edges = model.edges.map(edge => createEdgeLayout(edge, nodesById, modelNodesById, portsByNodeAndId, model.selection.includes(edge.id), invalidIds.has(edge.id)))

  return {
    nodes,
    edges,
    ports,
    palette: { id: 'palette', x: 0, y: 0, width: paletteWidth, height: options.height },
    inspector: { id: 'inspector', x: options.width - inspectorWidth, y: 0, width: inspectorWidth, height: options.height - validationHeight },
    canvas: { id: 'canvas', ...canvas },
    validation: { id: 'validation', x: options.width - inspectorWidth, y: options.height - validationHeight, width: inspectorWidth, height: validationHeight },
    diagnostics: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      indexedItems: nodes.length + edges.length + ports.length + 4,
    },
  }
}

/** Выполняет hit-test по layout plan. */
export function hitTestProcessModelerLayout(layout: ProcessModelerLayout, point: ProcessPoint): ProcessModelerHitTarget {
  const paletteKind = hitPalette(layout.palette, point)
  if (paletteKind) return { type: 'palette', id: paletteKind, kind: paletteKind }
  if (contains(layout.inspector, point)) return { type: 'inspector', id: 'inspector' }
  if (contains(layout.validation, point)) return { type: 'validation', id: 'validation' }

  for (let index = layout.ports.length - 1; index >= 0; index -= 1) {
    const port = layout.ports[index]!
    if (contains(port.bounds, point)) {
      return { type: 'port', id: `${port.nodeId}:${port.id}`, nodeId: port.nodeId, portId: port.id, direction: port.direction }
    }
  }

  for (let index = layout.nodes.length - 1; index >= 0; index -= 1) {
    const node = layout.nodes[index]!
    if (contains(node, point)) return { type: 'node', id: node.id }
  }

  for (let index = layout.edges.length - 1; index >= 0; index -= 1) {
    const edge = layout.edges[index]!
    if (hitEdge(edge.points, point)) return { type: 'edge', id: edge.id }
  }

  if (contains(layout.canvas, point)) return { type: 'canvas', id: 'canvas' }
  return { type: 'empty' }
}

/** Возвращает прямоугольник, охватывающий process nodes. */
export function processModelBounds(model: ProcessModel): ProcessRect {
  if (model.nodes.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  const minX = Math.min(...model.nodes.map(node => node.x))
  const minY = Math.min(...model.nodes.map(node => node.y))
  const maxX = Math.max(...model.nodes.map(node => node.x + node.width))
  const maxY = Math.max(...model.nodes.map(node => node.y + node.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function createEdgeLayout(
  edge: ProcessEdge,
  nodesById: Map<string, ProcessModelerNodeLayout>,
  modelNodesById: Map<string, ProcessModel['nodes'][number]>,
  portsByNodeAndId: Map<string, ProcessModelerLayout['ports'][number]>,
  selected: boolean,
  invalid: boolean,
): ProcessModelerEdgeLayout {
  const source = nodesById.get(edge.sourceId)
  const target = nodesById.get(edge.targetId)
  const sourceNode = modelNodesById.get(edge.sourceId)
  const targetNode = modelNodesById.get(edge.targetId)
  if (!source || !target || !sourceNode || !targetNode) {
    return {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      selected,
      invalid: true,
      points: [],
      label: edge.metadata.name,
    }
  }

  const edgePortIds = resolveProcessEdgePortIds(sourceNode, targetNode, edge)
  const sourcePort = edgePortIds.sourcePortId ? portsByNodeAndId.get(`${edge.sourceId}:${edgePortIds.sourcePortId}`) : undefined
  const targetPort = edgePortIds.targetPortId ? portsByNodeAndId.get(`${edge.targetId}:${edgePortIds.targetPortId}`) : undefined
  const start = sourcePort ?? fallbackPortPoint(source, 'output')
  const end = targetPort ?? fallbackPortPoint(target, 'input')
  const midX = start.x + (end.x - start.x) / 2

  return {
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    sourcePortId: sourcePort?.id,
    targetPortId: targetPort?.id,
    selected,
    invalid,
    points: [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
    label: edge.metadata.name,
  }
}

function fallbackPortPoint(node: ProcessModelerNodeLayout, direction: 'input' | 'output'): ProcessPoint {
  if (direction === 'input') return { x: node.x, y: node.y + node.height / 2 }
  return { x: node.x + node.width, y: node.y + node.height / 2 }
}

function createPortConnectionCounts(model: ProcessModel): Map<string, number> {
  const result = new Map<string, number>()
  const nodesById = new Map(model.nodes.map(node => [node.id, node]))
  for (const node of model.nodes) {
    for (const port of resolveProcessNodePortDefinitions(node)) {
      result.set(`${node.id}:${port.id}`, 0)
    }
  }
  for (const edge of model.edges) {
    const source = nodesById.get(edge.sourceId)
    const target = nodesById.get(edge.targetId)
    if (!source || !target) continue
    const portIds = resolveProcessEdgePortIds(source, target, edge)
    if (portIds.sourcePortId) increment(result, `${source.id}:${portIds.sourcePortId}`)
    if (portIds.targetPortId) increment(result, `${target.id}:${portIds.targetPortId}`)
  }
  return result
}

function increment(map: Map<string, number>, key: string): void {
  const current = map.get(key)
  if (current === undefined) {
    map.set(key, 1)
    return
  }
  map.set(key, current + 1)
}

function hitPalette(rect: ProcessRect, point: ProcessPoint): ProcessModelerHitTarget['kind'] | undefined {
  if (!contains(rect, point)) return undefined
  const row = Math.floor((point.y - 70) / 42)
  return ['startEvent', 'userTask', 'serviceTask', 'exclusiveGateway', 'parallelGateway', 'endEvent'][row] as ProcessModelerHitTarget['kind'] | undefined
}

function contains(rect: ProcessRect, point: ProcessPoint): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
}

function hitEdge(points: Array<ProcessPoint>, point: ProcessPoint): boolean {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!
    const end = points[index]!
    if (distanceToSegment(point, start, end) <= EDGE_HIT_TOLERANCE) return true
  }
  return false
}

function distanceToSegment(point: ProcessPoint, start: ProcessPoint, end: ProcessPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

function defaultNodeLabel(kind: string): string {
  return kind
    .replace('Event', ' event')
    .replace('Task', ' task')
    .replace('Gateway', ' gateway')
}
