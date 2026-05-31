import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnEventPosition = 'start' | 'intermediate' | 'end'
export type BpmnEventTrigger = 'none'

export interface BpmnEventElementData extends Record<string, unknown> {
  eventPosition: BpmnEventPosition
  trigger: BpmnEventTrigger
}

export type BpmnEventElement = ModelerElement<BpmnEventElementData>

export type BpmnEventElementInput =
  ModelerElementInput<Partial<BpmnEventElementData>> & {
    eventPosition?: BpmnEventPosition
    trigger?: BpmnEventTrigger
  }
