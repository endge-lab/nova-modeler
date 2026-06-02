import type {
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElement,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_CALL_ACTIVITY_TYPE,
} from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import {
  BPMN_DATA_OBJECT_TYPE,
} from '@/elements/bpmn/data/data-object/bpmn-data-object.factory'
import {
  BPMN_DATA_STORE_TYPE,
} from '@/elements/bpmn/data/data-store/bpmn-data-store.factory'
import {
  BPMN_SUB_PROCESS_TYPE,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import {
  BPMN_TASK_TYPE,
} from '@/elements/bpmn/task/bpmn-task.factory'
import type {
  BpmnDataAssociationElement,
  BpmnDataAssociationElementInput,
  BpmnDataAssociationType,
} from '@/elements/bpmn/data-association/bpmn-data-association.types'
import { normalizeExternalLabelGeometry } from '@/tools/external-label-geometry'

export const BPMN_DATA_ASSOCIATION_TYPE = 'bpmn.dataAssociation'

export function createBpmnDataAssociationElement(input: BpmnDataAssociationElementInput): BpmnDataAssociationElement {
  const source = normalizeEndpoint(input.source, { x: finiteNumber(input.x, 0), y: finiteNumber(input.y, 0) })
  const target = normalizeEndpoint(input.target, source.point ?? { x: 0, y: 0 })
  const dataAssociationType = normalizeBpmnDataAssociationType(input.dataAssociationType ?? input.data?.dataAssociationType)
  return {
    id: input.id,
    type: BPMN_DATA_ASSOCIATION_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: finiteNumber(input.width, 0),
    height: finiteNumber(input.height, 0),
    rotation: input.rotation,
    zIndex: input.zIndex ?? -95,
    source,
    target,
    waypoints: normalizeWaypoints(input.waypoints),
    data: {
      ...input.data,
      associationType: 'directed',
      dataAssociationType,
      name: normalizeOptionalText(input.name ?? input.data?.name),
      label: normalizeExternalLabelGeometry(input.label ?? input.data?.label),
    },
    style: { ...input.style },
  }
}

export function createBpmnDataAssociationForEndpoints(input: BpmnDataAssociationElementInput, source?: ModelerElement, target?: ModelerElement): BpmnDataAssociationElement {
  return createBpmnDataAssociationElement({
    ...input,
    dataAssociationType: resolveBpmnDataAssociationType(source, target, input.dataAssociationType ?? input.data?.dataAssociationType),
  })
}

export function normalizeBpmnDataAssociationType(value: unknown): BpmnDataAssociationType {
  return value === 'output' ? 'output' : 'input'
}

export function resolveBpmnDataAssociationType(
  source: ModelerElement | undefined,
  target: ModelerElement | undefined,
  fallback: unknown = 'input',
): BpmnDataAssociationType {
  if (source && target) {
    if (isBpmnDataAssociationDataElement(source) && isBpmnDataAssociationActivityElement(target)) return 'input'
    if (isBpmnDataAssociationActivityElement(source) && isBpmnDataAssociationDataElement(target)) return 'output'
  }
  return normalizeBpmnDataAssociationType(fallback)
}

export function isBpmnDataAssociationActivityElement(element: ModelerElement): boolean {
  return element.type === BPMN_TASK_TYPE
    || element.type === BPMN_SUB_PROCESS_TYPE
    || element.type === BPMN_CALL_ACTIVITY_TYPE
}

export function isBpmnDataAssociationDataElement(element: ModelerElement): boolean {
  return element.type === BPMN_DATA_OBJECT_TYPE || element.type === BPMN_DATA_STORE_TYPE
}

export function canConnectBpmnDataAssociation(source: ModelerElement, target: ModelerElement): boolean {
  return (isBpmnDataAssociationDataElement(source) && isBpmnDataAssociationActivityElement(target))
    || (isBpmnDataAssociationActivityElement(source) && isBpmnDataAssociationDataElement(target))
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

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
