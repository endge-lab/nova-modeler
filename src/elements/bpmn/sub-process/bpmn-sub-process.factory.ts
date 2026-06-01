import { normalizeBpmnTaskLoopType } from '@/elements/bpmn/task/bpmn-task.factory'
import type {
  BpmnSubProcessElement,
  BpmnSubProcessElementInput,
  BpmnSubProcessType,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.types'

export const BPMN_SUB_PROCESS_TYPE = 'bpmn.subProcess'
export const BPMN_SUB_PROCESS_DEFAULT_WIDTH = 160
export const BPMN_SUB_PROCESS_DEFAULT_HEIGHT = 100
export const BPMN_SUB_PROCESS_MIN_WIDTH = 96
export const BPMN_SUB_PROCESS_MIN_HEIGHT = 64

export function createBpmnSubProcessElement(input: BpmnSubProcessElementInput): BpmnSubProcessElement {
  const data = input.data ?? {}
  return {
    id: input.id,
    type: BPMN_SUB_PROCESS_TYPE,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: normalizeSize(input.width, BPMN_SUB_PROCESS_DEFAULT_WIDTH),
    height: normalizeSize(input.height, BPMN_SUB_PROCESS_DEFAULT_HEIGHT),
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      name: normalizeBpmnSubProcessName(input.name ?? data.name),
      subProcessType: normalizeBpmnSubProcessType(input.subProcessType ?? data.subProcessType),
      loopType: normalizeBpmnTaskLoopType(input.loopType ?? data.loopType),
      isForCompensation: normalizeBoolean(input.isForCompensation ?? data.isForCompensation),
    },
    style: input.style ? { ...input.style } : {},
  }
}

export function normalizeBpmnSubProcessType(value: unknown): BpmnSubProcessType {
  return value === 'event'
    || value === 'transaction'
    || value === 'adHoc'
    || value === 'embedded'
    ? value
    : 'embedded'
}

function normalizeBpmnSubProcessName(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Sub-process'
}

function normalizeBoolean(value: unknown): boolean {
  return value === true
}

function normalizeSize(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}
