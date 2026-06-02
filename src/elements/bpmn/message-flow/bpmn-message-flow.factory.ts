import type {
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElement,
  ModelerPoint,
} from '@/domain/types/index'
import { BPMN_BOUNDARY_EVENT_TYPE } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import { BPMN_EVENT_TYPE } from '@/elements/bpmn/event/bpmn-event.factory'
import {
  BPMN_PARTICIPANT_TYPE,
  isElementInsideBpmnParticipantContent,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import { BPMN_SUB_PROCESS_TYPE } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import { BPMN_TASK_TYPE } from '@/elements/bpmn/task/bpmn-task.factory'
import type {
  BpmnMessageFlowElement,
  BpmnMessageFlowElementInput,
} from '@/elements/bpmn/message-flow/bpmn-message-flow.types'
import { normalizeExternalLabelGeometry } from '@/tools/external-label-geometry'

export const BPMN_MESSAGE_FLOW_TYPE = 'bpmn.messageFlow'

export function createBpmnMessageFlowElement(input: BpmnMessageFlowElementInput): BpmnMessageFlowElement {
  const source = normalizeEndpoint(input.source, { x: finiteNumber(input.x, 0), y: finiteNumber(input.y, 0) })
  const target = normalizeEndpoint(input.target, source.point ?? { x: 0, y: 0 })
  return {
    id: input.id,
    type: BPMN_MESSAGE_FLOW_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: finiteNumber(input.width, 0),
    height: finiteNumber(input.height, 0),
    rotation: input.rotation,
    zIndex: input.zIndex ?? -96,
    source,
    target,
    waypoints: normalizeWaypoints(input.waypoints),
    data: {
      ...input.data,
      name: normalizeOptionalText(input.name ?? input.data?.name),
      messageRef: normalizeOptionalRef(input.messageRef ?? input.data?.messageRef),
      label: normalizeExternalLabelGeometry(input.label ?? input.data?.label),
    },
    style: { ...input.style },
  }
}

export function canConnectBpmnMessageFlow(elements: Array<ModelerElement>, source: ModelerElement, target: ModelerElement): boolean {
  if (source.id === target.id) return false
  if (!isBpmnMessageFlowNode(source) || !isBpmnMessageFlowNode(target)) return false
  const sourceParticipantId = resolveBpmnMessageFlowParticipantId(elements, source)
  const targetParticipantId = resolveBpmnMessageFlowParticipantId(elements, target)
  return Boolean(sourceParticipantId && targetParticipantId && sourceParticipantId !== targetParticipantId)
}

export function isBpmnMessageFlowNode(element: ModelerElement): boolean {
  return element.type === BPMN_PARTICIPANT_TYPE
    || element.type === BPMN_EVENT_TYPE
    || element.type === BPMN_BOUNDARY_EVENT_TYPE
    || element.type === BPMN_TASK_TYPE
    || element.type === BPMN_SUB_PROCESS_TYPE
    || element.type === BPMN_CALL_ACTIVITY_TYPE
}

export function resolveBpmnMessageFlowParticipantId(elements: Array<ModelerElement>, element: ModelerElement): string | undefined {
  if (element.type === BPMN_PARTICIPANT_TYPE) return element.id
  const participants = elements.filter((item): item is BpmnParticipantElement => item.type === BPMN_PARTICIPANT_TYPE)
  return participants.find(participant => isElementInsideBpmnParticipantContent(element, participant))?.id
}

function normalizeEndpoint(input: ModelerEdgeEndpoint | undefined, fallback: ModelerPoint): ModelerEdgeEndpoint {
  return {
    elementId: typeof input?.elementId === 'string' ? input.elementId : undefined,
    portId: typeof input?.portId === 'string' ? input.portId : undefined,
    point: normalizePoint(input?.point, fallback),
  }
}

function normalizeWaypoints(input: Array<ModelerEdgeWaypoint> | undefined): Array<ModelerEdgeWaypoint> {
  return (input ?? []).map(point => normalizePoint(point, { x: 0, y: 0 }))
}

function normalizePoint(input: ModelerPoint | undefined, fallback: ModelerPoint): ModelerPoint {
  return {
    x: finiteNumber(input?.x, fallback.x),
    y: finiteNumber(input?.y, fallback.y),
  }
}

function normalizeOptionalRef(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
