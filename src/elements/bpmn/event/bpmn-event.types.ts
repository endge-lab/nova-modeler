import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnEventPosition = 'start' | 'intermediate' | 'end'
export type BpmnEventTrigger =
  | 'none'
  | 'message'
  | 'timer'
  | 'error'
  | 'escalation'
  | 'cancel'
  | 'compensation'
  | 'conditional'
  | 'link'
  | 'signal'
  | 'terminate'
  | 'multiple'
  | 'parallelMultiple'
export type BpmnEventDirection = 'catch' | 'throw'

export interface BpmnEventElementData extends Record<string, unknown> {
  eventPosition: BpmnEventPosition
  trigger: BpmnEventTrigger
  direction?: BpmnEventDirection
  messageRef?: string
  signalRef?: string
  errorRef?: string
  escalationRef?: string
}

export type BpmnEventElement = ModelerElement<BpmnEventElementData>

export type BpmnEventElementInput =
  ModelerElementInput<Partial<BpmnEventElementData>> & {
    eventPosition?: BpmnEventPosition
    trigger?: BpmnEventTrigger
    direction?: BpmnEventDirection
    messageRef?: string
    signalRef?: string
    errorRef?: string
    escalationRef?: string
  }
