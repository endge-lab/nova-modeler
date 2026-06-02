import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerRect, ModelerViewport } from '@/domain/types/model/geometry.types'
import type { ModelerLayout, ModelerModel } from '@/domain/types/model/model.types'

export interface ModelerVisibilityClassifier {
  isEdge(element: ModelerElement): boolean
  isRecipeNodeType(type: string): boolean
  isRecipeRenderable(element: ModelerElement): boolean
}

export interface ModelerVisibilityForcedInput {
  selectedIds?: ReadonlyArray<string>
  connectionTargetId?: string
  edgeSegmentHoverElementId?: string
  contextPadTargetId?: string
  forcedIds?: ReadonlyArray<string | undefined>
}

export interface ModelerVisibilityResolveInput extends ModelerVisibilityForcedInput {
  model: ModelerModel
  layout: ModelerLayout
  viewport: ModelerViewport
  useBpmnRecipes: boolean
  recipeCulling: boolean
  classifier: ModelerVisibilityClassifier
}

export interface ModelerVisibilityDiagnostics {
  elementsVersion: number
  viewportVersion: number
  signature: string
  indexRebuilds: number
  indexedNodes: number
  indexedEdges: number
  queryNodeCandidates: number
  queryEdgeCandidates: number
  totalElements: number
  totalNodes: number
  totalEdges: number
  visibleElements: number
  visibleNodes: number
  visibleEdges: number
  recipeElements: number
  culledRecipeElements: number
  schemaFallbacks: number
  forcedElements: number
  queryMs: number
}

export interface ModelerVisibleElementsSnapshot {
  revision: number
  elementsVersion: number
  viewportVersion: number
  selectionVersion: number
  signature: string
  worldRect: ModelerRect
  nodes: Array<ModelerElement>
  edges: Array<ModelerElement>
  recipeNodes: Array<ModelerElement>
  schemaNodes: Array<ModelerElement>
  forcedNodes: Array<ModelerElement>
  forcedEdges: Array<ModelerElement>
  visibleIds: Set<string>
  forcedIds: Set<string>
  visibleElements: number
  totalElements: number
  culledRecipeElements: number
  schemaFallbacks: number
  diagnostics: ModelerVisibilityDiagnostics
}

export interface ModelerVisibilityApi {
  resolve(input: ModelerVisibilityResolveInput): ModelerVisibleElementsSnapshot
  getSnapshot(): ModelerVisibleElementsSnapshot
  getDiagnostics(): ModelerVisibilityDiagnostics
}
