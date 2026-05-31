import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnDataObjectType = 'object' | 'input' | 'output'

export interface BpmnDataObjectElementData extends Record<string, unknown> {
  name: string
  dataObjectType: BpmnDataObjectType
  isCollection: boolean
}

export type BpmnDataObjectElement = ModelerElement<BpmnDataObjectElementData>

export type BpmnDataObjectElementInput =
  ModelerElementInput<Partial<BpmnDataObjectElementData>> & {
    name?: string
    dataObjectType?: BpmnDataObjectType
    isCollection?: boolean
  }
