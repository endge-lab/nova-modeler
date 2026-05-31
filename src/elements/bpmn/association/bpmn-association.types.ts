import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnAssociationType = 'undirected' | 'directed' | 'bidirectional' | 'data'

export interface BpmnAssociationElementData extends Record<string, unknown> {
  associationType: BpmnAssociationType
}

export type BpmnAssociationElement = ModelerEdgeElement<BpmnAssociationElementData>

export type BpmnAssociationElementInput =
  ModelerElementInput<Partial<BpmnAssociationElementData>> & {
    source?: ModelerEdgeEndpoint
    target?: ModelerEdgeEndpoint
    waypoints?: Array<ModelerEdgeWaypoint>
    associationType?: BpmnAssociationType
  }
