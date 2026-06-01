import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'
import type { BpmnTaskLoopType } from '@/elements/bpmn/task/bpmn-task.types'

export interface BpmnCallActivityElementData extends Record<string, unknown> {
  name: string
  loopType: BpmnTaskLoopType
  isForCompensation: boolean
}

export type BpmnCallActivityElement = ModelerElement<BpmnCallActivityElementData>

export type BpmnCallActivityElementInput =
  ModelerElementInput<Partial<BpmnCallActivityElementData>> & {
    name?: string
    loopType?: BpmnTaskLoopType
    isForCompensation?: boolean
  }
