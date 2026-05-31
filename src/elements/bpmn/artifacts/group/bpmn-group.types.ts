import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export interface BpmnGroupElementData extends Record<string, unknown> {
  name: string
}

export type BpmnGroupElement = ModelerElement<BpmnGroupElementData>

export type BpmnGroupElementInput =
  ModelerElementInput<Partial<BpmnGroupElementData>> & {
    name?: string
  }
