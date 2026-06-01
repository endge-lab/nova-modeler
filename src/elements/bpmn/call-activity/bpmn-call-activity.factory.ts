import { normalizeBpmnTaskLoopType } from '@/elements/bpmn/task/bpmn-task.factory'
import type {
  BpmnCallActivityElement,
  BpmnCallActivityElementInput,
} from '@/elements/bpmn/call-activity/bpmn-call-activity.types'

export const BPMN_CALL_ACTIVITY_TYPE = 'bpmn.callActivity'
export const BPMN_CALL_ACTIVITY_DEFAULT_WIDTH = 160
export const BPMN_CALL_ACTIVITY_DEFAULT_HEIGHT = 100
export const BPMN_CALL_ACTIVITY_MIN_WIDTH = 96
export const BPMN_CALL_ACTIVITY_MIN_HEIGHT = 64

export function createBpmnCallActivityElement(input: BpmnCallActivityElementInput): BpmnCallActivityElement {
  const data = input.data ?? {}
  return {
    id: input.id,
    type: BPMN_CALL_ACTIVITY_TYPE,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: normalizeSize(input.width, BPMN_CALL_ACTIVITY_DEFAULT_WIDTH),
    height: normalizeSize(input.height, BPMN_CALL_ACTIVITY_DEFAULT_HEIGHT),
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      name: normalizeBpmnCallActivityName(input.name ?? data.name),
      loopType: normalizeBpmnTaskLoopType(input.loopType ?? data.loopType),
      isForCompensation: normalizeBoolean(input.isForCompensation ?? data.isForCompensation),
    },
    style: input.style ? { ...input.style } : {},
  }
}

function normalizeBpmnCallActivityName(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Call activity'
}

function normalizeBoolean(value: unknown): boolean {
  return value === true
}

function normalizeSize(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}
