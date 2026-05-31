import type {
  BpmnTaskElement,
  BpmnTaskElementInput,
  BpmnTaskLoopType,
  BpmnTaskType,
} from '@/elements/bpmn/task/bpmn-task.types'

export const BPMN_TASK_TYPE = 'bpmn.task'
export const BPMN_TASK_DEFAULT_WIDTH = 120
export const BPMN_TASK_DEFAULT_HEIGHT = 80
export const BPMN_TASK_MIN_WIDTH = 72
export const BPMN_TASK_MIN_HEIGHT = 48

export function createBpmnTaskElement(input: BpmnTaskElementInput): BpmnTaskElement {
  const data = input.data ?? {}
  const taskType = normalizeBpmnTaskType(input.taskType ?? data.taskType)
  return {
    id: input.id,
    type: BPMN_TASK_TYPE,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: BPMN_TASK_DEFAULT_WIDTH,
    height: BPMN_TASK_DEFAULT_HEIGHT,
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      name: normalizeBpmnTaskName(input.name ?? data.name),
      taskType,
      loopType: normalizeBpmnTaskLoopType(input.loopType ?? data.loopType),
      isForCompensation: normalizeBoolean(input.isForCompensation ?? data.isForCompensation),
      instantiate: taskType === 'receive'
        ? normalizeBoolean(input.instantiate ?? data.instantiate)
        : undefined,
    },
    style: input.style ? { ...input.style } : {},
  }
}

export function normalizeBpmnTaskType(value: unknown): BpmnTaskType {
  return value === 'user'
    || value === 'manual'
    || value === 'service'
    || value === 'script'
    || value === 'businessRule'
    || value === 'send'
    || value === 'receive'
    || value === 'none'
    ? value
    : 'none'
}

export function normalizeBpmnTaskLoopType(value: unknown): BpmnTaskLoopType {
  return value === 'standard'
    || value === 'multiInstanceParallel'
    || value === 'multiInstanceSequential'
    || value === 'none'
    ? value
    : 'none'
}

function normalizeBpmnTaskName(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Task'
}

function normalizeBoolean(value: unknown): boolean {
  return value === true
}
