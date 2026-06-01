import type { ModelerElement } from '@/domain/types/elements/element.types'
import type {
  BpmnGlobalDefinition,
  BpmnGlobalDefinitionInput,
} from '@/domain/types/model/bpmn-definitions.types'
import type {
  ModelerRect,
  ModelerViewport,
} from '@/domain/types/model/geometry.types'

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
  bpmnDefinitions: Array<BpmnGlobalDefinition>
  elements: Array<ModelerElement>
  selection: Array<string>
  version: number
  viewportVersion: number
  bpmnDefinitionsVersion: number
  elementsVersion: number
  selectionVersion: number
}

export interface ModelerModelInput {
  id?: string
  viewport?: Partial<ModelerViewport>
  canvas?: Partial<ModelerCanvas>
  bpmnDefinitions?: Array<BpmnGlobalDefinitionInput>
  elements?: Array<ModelerElement>
  selection?: Array<string>
}

export interface ModelerLayout {
  width: number
  height: number
  canvas: ModelerRect
  viewport: ModelerViewport
  worldBounds: ModelerRect
}
