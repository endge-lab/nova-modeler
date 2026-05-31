import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export interface BpmnDataStoreElementData extends Record<string, unknown> {
  name: string
}

export type BpmnDataStoreElement = ModelerElement<BpmnDataStoreElementData>

export type BpmnDataStoreElementInput =
  ModelerElementInput<Partial<BpmnDataStoreElementData>> & {
    name?: string
  }
