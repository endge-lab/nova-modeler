import type { ModelerViewport } from '@/domain/types/geometry.types'
import type { ModelerCanvas, ModelerModel, ModelerModelInput } from '@/domain/types/model.types'
import type { ModelerCommand } from '@/domain/types/command.types'

export interface ModelerViewportStore {
  x: number
  y: number
  scale: number
  load(input?: Partial<ModelerViewport>): void
  toJSON(): ModelerViewport
}

export interface ModelerCanvasStore {
  x: number
  y: number
  width: number
  height: number
  gridSize: number
  load(input?: Partial<ModelerCanvas>): void
  toJSON(): ModelerCanvas
}

export interface ModelerSelectionStore {
  ids: Array<string>
  set(ids: Array<string>): void
  toJSON(): Array<string>
}

export interface ModelerStore {
  viewport: ModelerViewportStore
  canvas: ModelerCanvasStore
  selection: ModelerSelectionStore
  id: string
  version: number
  viewportVersion: number
  selectionVersion: number
  getModel(): ModelerModel
  setModel(input: ModelerModel | ModelerModelInput): ModelerModel
  apply(command: ModelerCommand): ModelerModel
  setViewport(viewport: Partial<ModelerViewport>): void
  setSelection(ids: Array<string>): void
  load(input?: ModelerModel | ModelerModelInput): void
  toModel(): ModelerModel
}
