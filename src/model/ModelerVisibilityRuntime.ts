import type { NovaBounds } from '@endge/nova'
import type {
  ModelerEdgeElement,
  ModelerElement,
  ModelerLayout,
  ModelerRect,
  ModelerViewport,
  ModelerVisibilityApi,
  ModelerVisibilityDiagnostics,
  ModelerVisibilityResolveInput,
  ModelerVisibleElementsSnapshot,
} from '@/domain/types/index'
import { NovaHitIndex } from '@endge/nova'
import { isModelerEdgeElement } from '@/domain/types/index'

const DEFAULT_VIEWPORT_PADDING = 512
const DEFAULT_VIEWPORT_SCREEN_PADDING = 256
const MIN_VIEWPORT_PADDING = 96
const EDGE_ROUTE_PADDING = 160

export class ModelerVisibilityRuntime implements ModelerVisibilityApi {
  private readonly _nodeIndex = new NovaHitIndex<ModelerElement>({
    getBounds: element => this._resolveNodeBounds(element),
  })

  private readonly _edgeIndex = new NovaHitIndex<ModelerElement>({
    getBounds: element => this._resolveEdgeBounds(element),
  })

  private readonly _elementsById = new Map<string, ModelerElement>()
  private _indexedModelId: string | null = null
  private _indexedElementsVersion = -1
  private _indexedNodes: Array<ModelerElement> = []
  private _indexedEdges: Array<ModelerElement> = []
  private _resolveExternalLabelBoundsInput: ((element: ModelerElement) => ModelerRect | null) | undefined
  private _revision = 0
  private _signature = ''
  private _indexRebuilds = 0
  private _snapshot: ModelerVisibleElementsSnapshot = createEmptySnapshot()
  private _diagnostics: ModelerVisibilityDiagnostics = createEmptyDiagnostics()

  resolve(input: ModelerVisibilityResolveInput): ModelerVisibleElementsSnapshot {
    this._ensureIndexes(input)

    const queryStartedAt = performanceNow()
    const worldRect = createModelerVisibleWorldRect(input.viewport, input.layout)
    const nodeCandidates = input.recipeCulling
      ? this._nodeIndex.queryBounds(worldRect)
      : this._indexedNodes
    const edgeCandidates = input.recipeCulling
      ? this._edgeIndex.queryBounds(worldRect)
      : this._indexedEdges
    const forcedIds = this._resolveForcedIds(input)
    const nodeMap = new Map<string, ModelerElement>()
    const edgeMap = new Map<string, ModelerElement>()
    const forcedNodeMap = new Map<string, ModelerElement>()
    const forcedEdgeMap = new Map<string, ModelerElement>()

    for (const element of nodeCandidates) {
      nodeMap.set(element.id, element)
    }
    for (const element of edgeCandidates) {
      edgeMap.set(element.id, element)
    }

    for (const id of forcedIds) {
      const element = this._elementsById.get(id)
      if (!element) {
        continue
      }
      const isEdge = input.classifier.isEdge(element)
      if (isEdge) {
        edgeMap.set(element.id, element)
        forcedEdgeMap.set(element.id, element)
      }
      else {
        nodeMap.set(element.id, element)
        forcedNodeMap.set(element.id, element)
      }
    }

    const selectedIds = new Set(input.selectedIds ?? [])
    const connectionTargetId = input.connectionTargetId
    const nodes = sortElementsByRenderOrder([...nodeMap.values()])
    const edges = sortElementsByRenderOrder([...edgeMap.values()])
    const recipeNodes: Array<ModelerElement> = []
    const schemaNodes: Array<ModelerElement> = []
    let schemaFallbacks = 0

    for (const element of nodes) {
      if (
        input.useBpmnRecipes
        && input.classifier.isRecipeRenderable(element)
        && !selectedIds.has(element.id)
        && connectionTargetId !== element.id
        && !forcedNodeMap.has(element.id)
      ) {
        recipeNodes.push(element)
        continue
      }
      if (input.useBpmnRecipes && input.classifier.isRecipeNodeType(element.type)) {
        schemaFallbacks += 1
      }
      schemaNodes.push(element)
    }

    const visibleRecipeIds = new Set(recipeNodes.map(element => element.id))
    let totalRecipeCandidates = 0
    for (const element of this._indexedNodes) {
      if (!input.classifier.isRecipeRenderable(element)) {
        continue
      }
      if (selectedIds.has(element.id) || connectionTargetId === element.id) {
        continue
      }
      totalRecipeCandidates += 1
    }
    const culledRecipeElements = input.useBpmnRecipes
      ? Math.max(0, totalRecipeCandidates - visibleRecipeIds.size)
      : 0
    const visibleIds = new Set<string>()
    for (const element of nodes) {
      visibleIds.add(element.id)
    }
    for (const element of edges) {
      visibleIds.add(element.id)
    }
    const nextSignature = createVisibilitySignature(nodes, edges, recipeNodes, schemaNodes, forcedIds)
    if (nextSignature !== this._signature) {
      this._signature = nextSignature
      this._revision += 1
    }

    const queryMs = performanceNow() - queryStartedAt
    this._diagnostics = {
      elementsVersion: input.model.elementsVersion,
      viewportVersion: input.model.viewportVersion,
      signature: this._signature,
      indexRebuilds: this._indexRebuilds,
      indexedNodes: this._nodeIndex.indexedNodeCount,
      indexedEdges: this._edgeIndex.indexedNodeCount,
      queryNodeCandidates: input.recipeCulling ? this._nodeIndex.lastQueryCandidateCount : nodeCandidates.length,
      queryEdgeCandidates: input.recipeCulling ? this._edgeIndex.lastQueryCandidateCount : edgeCandidates.length,
      totalElements: input.model.elements.length,
      totalNodes: this._indexedNodes.length,
      totalEdges: this._indexedEdges.length,
      visibleElements: visibleIds.size,
      visibleNodes: nodes.length,
      visibleEdges: edges.length,
      recipeElements: recipeNodes.length,
      culledRecipeElements,
      schemaFallbacks,
      forcedElements: forcedNodeMap.size + forcedEdgeMap.size,
      queryMs,
    }
    this._snapshot = {
      revision: this._revision,
      elementsVersion: input.model.elementsVersion,
      viewportVersion: input.model.viewportVersion,
      selectionVersion: input.model.selectionVersion,
      signature: this._signature,
      worldRect,
      nodes,
      edges,
      recipeNodes,
      schemaNodes,
      forcedNodes: [...forcedNodeMap.values()],
      forcedEdges: [...forcedEdgeMap.values()],
      visibleIds,
      forcedIds,
      visibleElements: visibleIds.size,
      totalElements: input.model.elements.length,
      culledRecipeElements,
      schemaFallbacks,
      diagnostics: this._diagnostics,
    }
    return this._snapshot
  }

  getSnapshot(): ModelerVisibleElementsSnapshot {
    return this._snapshot
  }

  getDiagnostics(): ModelerVisibilityDiagnostics {
    return this._diagnostics
  }

  private _ensureIndexes(input: ModelerVisibilityResolveInput): void {
    if (
      this._indexedModelId === input.model.id
      && this._indexedElementsVersion === input.model.elementsVersion
    ) {
      return
    }

    this._indexedModelId = input.model.id
    this._indexedElementsVersion = input.model.elementsVersion
    this._resolveExternalLabelBoundsInput = input.resolveExternalLabelBounds
    this._elementsById.clear()
    this._indexedNodes = []
    this._indexedEdges = []

    for (const element of input.model.elements) {
      this._elementsById.set(element.id, element)
      if (input.classifier.isEdge(element)) {
        this._indexedEdges.push(element)
      }
      else { this._indexedNodes.push(element) }
    }

    this._nodeIndex.rebuild(this._indexedNodes)
    this._edgeIndex.rebuild(this._indexedEdges)
    this._indexRebuilds += 1
  }

  private _resolveForcedIds(input: ModelerVisibilityResolveInput): Set<string> {
    const forcedIds = new Set<string>()
    for (const id of input.selectedIds ?? []) {
      forcedIds.add(id)
    }
    if (input.connectionTargetId) {
      forcedIds.add(input.connectionTargetId)
    }
    if (input.edgeSegmentHoverElementId) {
      forcedIds.add(input.edgeSegmentHoverElementId)
    }
    if (input.contextPadTargetId) {
      forcedIds.add(input.contextPadTargetId)
    }
    for (const id of input.forcedIds ?? []) {
      if (id) {
        forcedIds.add(id)
      }
    }
    return forcedIds
  }

  private _resolveNodeBounds(element: ModelerElement): NovaBounds {
    const bounds = {
      x: element.x,
      y: element.y,
      width: Math.max(1, element.width),
      height: Math.max(1, element.height),
    }
    return unionBounds(bounds, this._resolveExternalLabelBoundsInput?.(element))
  }

  private _resolveEdgeBounds(element: ModelerElement): NovaBounds {
    if (!isModelerEdgeElement(element)) {
      return this._resolveNodeBounds(element)
    }
    const points = resolveEdgeRoutePoints(element)
    if (points.length === 0) {
      return this._resolveNodeBounds(element)
    }
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const point of points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
    if (element.width > 0 && element.height > 0) {
      minX = Math.min(minX, element.x)
      minY = Math.min(minY, element.y)
      maxX = Math.max(maxX, element.x + element.width)
      maxY = Math.max(maxY, element.y + element.height)
    }
    const bounds = {
      x: minX - EDGE_ROUTE_PADDING,
      y: minY - EDGE_ROUTE_PADDING,
      width: Math.max(1, maxX - minX + EDGE_ROUTE_PADDING * 2),
      height: Math.max(1, maxY - minY + EDGE_ROUTE_PADDING * 2),
    }
    return unionBounds(bounds, this._resolveExternalLabelBoundsInput?.(element))
  }
}

function unionBounds(a: NovaBounds, b: ModelerRect | null | undefined): NovaBounds {
  if (!b) {
    return a
  }
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  }
}

export function createModelerVisibleWorldRect(
  viewport: ModelerViewport,
  layout: ModelerLayout,
  padding = DEFAULT_VIEWPORT_PADDING,
): ModelerRect {
  const scale = viewport.scale > 0 ? viewport.scale : 1
  const effectivePadding = resolveViewportPadding(padding, scale)
  return {
    x: (-viewport.x) / scale - effectivePadding,
    y: (-viewport.y) / scale - effectivePadding,
    width: layout.width / scale + effectivePadding * 2,
    height: layout.height / scale + effectivePadding * 2,
  }
}

function resolveViewportPadding(maxWorldPadding: number, scale: number): number {
  if (maxWorldPadding <= 0) {
    return 0
  }
  const screenPadding = DEFAULT_VIEWPORT_SCREEN_PADDING / scale
  return Math.min(maxWorldPadding, Math.max(MIN_VIEWPORT_PADDING, screenPadding))
}

function resolveEdgeRoutePoints(element: ModelerEdgeElement): Array<{ x: number, y: number }> {
  const points: Array<{ x: number, y: number }> = []
  if (element.source.point) {
    points.push(element.source.point)
  }
  points.push(...element.waypoints)
  if (element.target.point) {
    points.push(element.target.point)
  }
  return points
}

function sortElementsByRenderOrder(elements: Array<ModelerElement>): Array<ModelerElement> {
  return elements.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.id.localeCompare(b.id))
}

function createVisibilitySignature(
  nodes: Array<ModelerElement>,
  edges: Array<ModelerElement>,
  recipeNodes: Array<ModelerElement>,
  schemaNodes: Array<ModelerElement>,
  forcedIds: Set<string>,
): string {
  return [
    `n:${nodes.map(element => element.id).join(',')}`,
    `e:${edges.map(element => element.id).join(',')}`,
    `r:${recipeNodes.map(element => element.id).join(',')}`,
    `s:${schemaNodes.map(element => element.id).join(',')}`,
    `f:${[...forcedIds].sort().join(',')}`,
  ].join('|')
}

function createEmptyDiagnostics(): ModelerVisibilityDiagnostics {
  return {
    elementsVersion: -1,
    viewportVersion: -1,
    signature: '',
    indexRebuilds: 0,
    indexedNodes: 0,
    indexedEdges: 0,
    queryNodeCandidates: 0,
    queryEdgeCandidates: 0,
    totalElements: 0,
    totalNodes: 0,
    totalEdges: 0,
    visibleElements: 0,
    visibleNodes: 0,
    visibleEdges: 0,
    recipeElements: 0,
    culledRecipeElements: 0,
    schemaFallbacks: 0,
    forcedElements: 0,
    queryMs: 0,
  }
}

function createEmptySnapshot(): ModelerVisibleElementsSnapshot {
  const diagnostics = createEmptyDiagnostics()
  return {
    revision: 0,
    elementsVersion: -1,
    viewportVersion: -1,
    selectionVersion: -1,
    signature: '',
    worldRect: { x: 0, y: 0, width: 0, height: 0 },
    nodes: [],
    edges: [],
    recipeNodes: [],
    schemaNodes: [],
    forcedNodes: [],
    forcedEdges: [],
    visibleIds: new Set(),
    forcedIds: new Set(),
    visibleElements: 0,
    totalElements: 0,
    culledRecipeElements: 0,
    schemaFallbacks: 0,
    diagnostics,
  }
}

function performanceNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}
