import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnTaskType =
  | 'none'
  | 'user'
  | 'manual'
  | 'service'
  | 'script'
  | 'businessRule'
  | 'send'
  | 'receive'

export type BpmnTaskLoopType =
  | 'none'
  | 'standard'
  | 'multiInstanceParallel'
  | 'multiInstanceSequential'

export interface BpmnTaskElementData extends Record<string, unknown> {
  name: string
  taskType: BpmnTaskType
  loopType: BpmnTaskLoopType
  isForCompensation: boolean
  instantiate?: boolean
  implementation?: string
  operationRef?: string
  messageRef?: string
  scriptFormat?: string
  script?: string
  decisionRef?: string
}

export type BpmnTaskElement = ModelerElement<BpmnTaskElementData>

export type BpmnTaskElementInput =
  ModelerElementInput<Partial<BpmnTaskElementData>> & {
    name?: string
    taskType?: BpmnTaskType
    loopType?: BpmnTaskLoopType
    isForCompensation?: boolean
    instantiate?: boolean
  }
