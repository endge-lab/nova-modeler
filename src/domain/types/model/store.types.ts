import type { ModelerCommand } from '@/domain/types/command.types'
import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerViewport } from '@/domain/types/model/geometry.types'
import type {
  ModelerCanvas,
  ModelerModel,
  ModelerModelInput,
} from '@/domain/types/model/model.types'

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

export interface ModelerElementsStore {
  items: Array<ModelerElement>
  load(input?: Array<ModelerElement>): void
  set(items: Array<ModelerElement>): void
  toJSON(): Array<ModelerElement>
}

export interface ModelerStore {
  viewport: ModelerViewportStore
  canvas: ModelerCanvasStore
  elements: ModelerElementsStore
  selection: ModelerSelectionStore
  id: string
  version: number
  viewportVersion: number
  elementsVersion: number
  selectionVersion: number
  getModel(): ModelerModel
  setModel(input: ModelerModel | ModelerModelInput): ModelerModel
  apply(command: ModelerCommand): ModelerModel
  setViewport(viewport: Partial<ModelerViewport>): void
  setSelection(ids: Array<string>): void
  load(input?: ModelerModel | ModelerModelInput): void
  toModel(): ModelerModel
}
