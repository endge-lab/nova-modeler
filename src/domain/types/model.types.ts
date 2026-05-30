import type {
  ModelerRect,
  ModelerViewport,
} from '@/domain/types/geometry.types'

export interface ModelerCanvas {
  x: number
  y: number
  width: number
  height: number
  gridSize: number
}

export interface ModelerModel {
  id: string
  viewport: ModelerViewport
  canvas: ModelerCanvas
  selection: Array<string>
  version: number
  viewportVersion: number
  selectionVersion: number
}

export interface ModelerModelInput {
  id?: string
  viewport?: Partial<ModelerViewport>
  canvas?: Partial<ModelerCanvas>
  selection?: Array<string>
}

export interface ModelerLayout {
  width: number
  height: number
  canvas: ModelerRect
  viewport: ModelerViewport
  worldBounds: ModelerRect
}

export type ModelerHitTarget = { type: 'canvas' | 'empty' }
