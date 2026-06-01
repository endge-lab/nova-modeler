import type { ModelerElement } from '@/domain/types/index'
import {
  BPMN_CALL_ACTIVITY_TYPE,
} from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import {
  BPMN_SUB_PROCESS_TYPE,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import {
  BPMN_TASK_TYPE,
} from '@/elements/bpmn/task/bpmn-task.factory'
import type {
  BpmnBoundaryEventElement,
  BpmnBoundaryEventElementInput,
  BpmnBoundaryEventTrigger,
} from '@/elements/bpmn/boundary-event/bpmn-boundary-event.types'

export const BPMN_BOUNDARY_EVENT_TYPE = 'bpmn.boundaryEvent'

export const BPMN_BOUNDARY_EVENT_DEFAULT_SIZE = 36

export const BPMN_BOUNDARY_EVENT_TRIGGERS: Array<{ id: BpmnBoundaryEventTrigger; title: string }> = [
  { id: 'message', title: 'Message boundary event' },
  { id: 'timer', title: 'Timer boundary event' },
  { id: 'error', title: 'Error boundary event' },
  { id: 'escalation', title: 'Escalation boundary event' },
  { id: 'cancel', title: 'Cancel boundary event' },
  { id: 'compensation', title: 'Compensation boundary event' },
  { id: 'conditional', title: 'Conditional boundary event' },
  { id: 'signal', title: 'Signal boundary event' },
]

export function createBpmnBoundaryEventElement(input: BpmnBoundaryEventElementInput): BpmnBoundaryEventElement {
  const data = input.data ?? {}
  const trigger = normalizeBpmnBoundaryEventTrigger(input.trigger ?? data.trigger)
  return {
    id: input.id,
    type: BPMN_BOUNDARY_EVENT_TYPE,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? BPMN_BOUNDARY_EVENT_DEFAULT_SIZE,
    height: input.height ?? BPMN_BOUNDARY_EVENT_DEFAULT_SIZE,
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      attachedToRef: normalizeAttachedToRef(input.attachedToRef ?? data.attachedToRef),
      eventPosition: 'intermediate',
      trigger,
      direction: 'catch',
      isInterrupting: normalizeInterrupting(input.isInterrupting ?? data.isInterrupting),
      messageRef: normalizeOptionalRef(input.messageRef ?? data.messageRef),
      signalRef: normalizeOptionalRef(input.signalRef ?? data.signalRef),
      errorRef: normalizeOptionalRef(input.errorRef ?? data.errorRef),
      escalationRef: normalizeOptionalRef(input.escalationRef ?? data.escalationRef),
    },
    style: input.style ? { ...input.style } : {},
  }
}

export function createBpmnBoundaryEventForActivity(
  activity: ModelerElement,
  input: Omit<BpmnBoundaryEventElementInput, 'attachedToRef' | 'x' | 'y'> & Partial<Pick<BpmnBoundaryEventElementInput, 'x' | 'y'>>,
): BpmnBoundaryEventElement {
  const size = input.width ?? input.height ?? BPMN_BOUNDARY_EVENT_DEFAULT_SIZE
  return createBpmnBoundaryEventElement({
    ...input,
    attachedToRef: activity.id,
    x: input.x ?? Math.round(activity.x + activity.width / 2 - size / 2),
    y: input.y ?? Math.round(activity.y + activity.height - size / 2),
    width: input.width ?? size,
    height: input.height ?? size,
  })
}

export function isBpmnBoundaryAttachableActivity(element: ModelerElement): boolean {
  return element.type === BPMN_TASK_TYPE
    || element.type === BPMN_SUB_PROCESS_TYPE
    || element.type === BPMN_CALL_ACTIVITY_TYPE
}

export function isBpmnBoundaryEventAttachedTo(element: ModelerElement, activityId: string): element is BpmnBoundaryEventElement {
  return element.type === BPMN_BOUNDARY_EVENT_TYPE
    && (element as BpmnBoundaryEventElement).data?.attachedToRef === activityId
}

export function normalizeBpmnBoundaryEventTrigger(value: unknown): BpmnBoundaryEventTrigger {
  return value === 'message'
    || value === 'error'
    || value === 'escalation'
    || value === 'cancel'
    || value === 'compensation'
    || value === 'conditional'
    || value === 'signal'
    || value === 'timer'
    ? value
    : 'timer'
}

function normalizeAttachedToRef(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeInterrupting(value: unknown): boolean {
  return value !== false
}

function normalizeOptionalRef(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
