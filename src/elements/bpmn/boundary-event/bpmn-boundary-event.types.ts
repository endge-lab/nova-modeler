import type {
  BpmnEventDirection,
  BpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.types'
import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnBoundaryEventTrigger =
  | 'message'
  | 'timer'
  | 'error'
  | 'escalation'
  | 'cancel'
  | 'compensation'
  | 'conditional'
  | 'signal'

export interface BpmnBoundaryEventElementData extends Record<string, unknown> {
  attachedToRef: string
  eventPosition: 'intermediate'
  trigger: BpmnBoundaryEventTrigger
  direction: BpmnEventDirection
  isInterrupting: boolean
  messageRef?: string
  signalRef?: string
  errorRef?: string
  escalationRef?: string
}

export type BpmnBoundaryEventElement = ModelerElement<BpmnBoundaryEventElementData>

export type BpmnBoundaryEventElementInput =
  ModelerElementInput<Partial<BpmnBoundaryEventElementData>> & {
    attachedToRef?: string
    trigger?: BpmnEventTrigger | BpmnBoundaryEventTrigger
    direction?: BpmnEventDirection
    isInterrupting?: boolean
    messageRef?: string
    signalRef?: string
    errorRef?: string
    escalationRef?: string
  }
