import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerRect, ModelerViewport } from '@/domain/types/model/geometry.types'
import type { BpmnGlobalDefinitionInput } from '@/domain/types/model/bpmn-definitions.types'

export type ModelerElementPatch = Partial<ModelerElement> & Record<string, unknown>

export type ModelerCommand =
  | { type: 'setViewport'; viewport: Partial<ModelerViewport> }
  | { type: 'select'; ids: Array<string> }
  | { type: 'bpmn.definitions.set'; definitions: Array<BpmnGlobalDefinitionInput> }
  | { type: 'element.add'; element: ModelerElement }
  | { type: 'element.delete'; id: string }
  | { type: 'element.deleteMany'; ids: Array<string> }
  | { type: 'element.replace'; id: string; element: ModelerElement }
  | { type: 'element.patch'; id: string; patch: ModelerElementPatch }
  | { type: 'element.resize'; id: string; bounds: Partial<ModelerRect> }
  | { type: 'element.move'; id: string; dx: number; dy: number }
  | { type: 'element.rotate'; id: string; rotation: number }
