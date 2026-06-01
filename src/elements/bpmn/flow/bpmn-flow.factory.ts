import type {
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerPoint,
} from '@/domain/types/index'
import type {
  BpmnFlowElement,
  BpmnFlowElementInput,
  BpmnFlowType,
} from '@/elements/bpmn/flow/bpmn-flow.types'

export const BPMN_FLOW_TYPE = 'bpmn.flow'

const BPMN_FLOW_TYPES = new Set<BpmnFlowType>([
  'sequence',
  'conditionalSequence',
  'defaultSequence',
])

export function createBpmnFlowElement(input: BpmnFlowElementInput): BpmnFlowElement {
  const source = normalizeEndpoint(input.source, { x: finiteNumber(input.x, 0), y: finiteNumber(input.y, 0) })
  const target = normalizeEndpoint(input.target, source.point ?? { x: 0, y: 0 })
  const data = {
    ...input.data,
    flowType: normalizeBpmnFlowType(input.flowType ?? input.data?.flowType),
    name: normalizeOptionalText(input.data?.name),
    conditionExpression: normalizeOptionalText(input.data?.conditionExpression),
  }
  return {
    id: input.id,
    type: BPMN_FLOW_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: finiteNumber(input.width, 0),
    height: finiteNumber(input.height, 0),
    rotation: input.rotation,
    zIndex: input.zIndex ?? -100,
    source,
    target,
    waypoints: normalizeWaypoints(input.waypoints),
    data,
    style: { ...input.style },
  }
}

export function normalizeBpmnFlowType(value: unknown): BpmnFlowType {
  return BPMN_FLOW_TYPES.has(value as BpmnFlowType) ? value as BpmnFlowType : 'sequence'
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
