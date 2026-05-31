import type { ModelerElement } from '@/domain/types/elements/element.types'
import type {
  ModelerPoint,
  ModelerRect,
} from '@/domain/types/model/geometry.types'
import type { ModelerResizeHandle } from '@/domain/types/interaction/resize.types'

export type ModelerSnapDisableModifier = 'alt' | 'meta' | 'shift' | 'ctrl' | 'none'

export interface ModelerSnapPointInput {
  point: ModelerPoint
  gridSize: number
  element?: ModelerElement
}

export interface ModelerSnapResizeInput {
  bounds: ModelerRect
  source: ModelerRect
  handle: ModelerResizeHandle
  gridSize: number
  element: ModelerElement
  minSize: { minWidth: number; minHeight: number }
}

export interface ModelerSnapStrategy {
  snapPoint(input: ModelerSnapPointInput): ModelerPoint
  snapResize(input: ModelerSnapResizeInput): ModelerRect
}

export interface ModelerSnapOptions {
  enabled?: boolean
  disableModifier?: ModelerSnapDisableModifier
  strategy?: ModelerSnapStrategy
}

export interface ModelerSnapMoveInput {
  element: ModelerElement
  raw: ModelerPoint
  event?: MouseEvent
}

export interface ModelerSnapRuntimeResizeInput {
  element: ModelerElement
  handle: ModelerResizeHandle
  rawBounds: ModelerRect
  minSize: { minWidth: number; minHeight: number }
  event?: MouseEvent
}
