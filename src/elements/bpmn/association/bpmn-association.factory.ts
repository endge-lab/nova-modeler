import type {
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerPoint,
} from '@/domain/types/index'
import type {
  BpmnAssociationElement,
  BpmnAssociationElementInput,
  BpmnAssociationType,
} from '@/elements/bpmn/association/bpmn-association.types'
import { normalizeExternalLabelGeometry } from '@/tools/external-label-geometry'

export const BPMN_ASSOCIATION_TYPE = 'bpmn.association'

const BPMN_ASSOCIATION_TYPES = new Set<BpmnAssociationType>([
  'undirected',
  'directed',
  'bidirectional',
  'data',
])

export function createBpmnAssociationElement(input: BpmnAssociationElementInput): BpmnAssociationElement {
  const source = normalizeEndpoint(input.source, { x: finiteNumber(input.x, 0), y: finiteNumber(input.y, 0) })
  const target = normalizeEndpoint(input.target, source.point ?? { x: 0, y: 0 })
  return {
    id: input.id,
    type: BPMN_ASSOCIATION_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: finiteNumber(input.width, 0),
    height: finiteNumber(input.height, 0),
    rotation: input.rotation,
    zIndex: input.zIndex ?? -90,
    source,
    target,
    waypoints: normalizeWaypoints(input.waypoints),
    data: {
      ...input.data,
      associationType: normalizeBpmnAssociationType(input.associationType ?? input.data?.associationType),
      name: normalizeOptionalText(input.name ?? input.data?.name),
      label: normalizeExternalLabelGeometry(input.label ?? input.data?.label),
    },
    style: { ...input.style },
  }
}

export function normalizeBpmnAssociationType(value: unknown): BpmnAssociationType {
  return BPMN_ASSOCIATION_TYPES.has(value as BpmnAssociationType) ? value as BpmnAssociationType : 'undirected'
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
