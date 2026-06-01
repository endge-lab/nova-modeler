import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'
import type { BpmnTaskLoopType } from '@/elements/bpmn/task/bpmn-task.types'

export type BpmnSubProcessType = 'embedded' | 'event' | 'transaction' | 'adHoc'

export interface BpmnSubProcessElementData extends Record<string, unknown> {
  name: string
  subProcessType: BpmnSubProcessType
  loopType: BpmnTaskLoopType
  isForCompensation: boolean
}

export type BpmnSubProcessElement = ModelerElement<BpmnSubProcessElementData>

export type BpmnSubProcessElementInput =
  ModelerElementInput<Partial<BpmnSubProcessElementData>> & {
    name?: string
    subProcessType?: BpmnSubProcessType
    loopType?: BpmnTaskLoopType
    isForCompensation?: boolean
  }
