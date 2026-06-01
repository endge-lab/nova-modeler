import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnDataAssociationType = 'input' | 'output'

export interface BpmnDataAssociationElementData extends Record<string, unknown> {
  associationType: 'directed'
  dataAssociationType: BpmnDataAssociationType
}

export type BpmnDataAssociationElement = ModelerEdgeElement<BpmnDataAssociationElementData>

export type BpmnDataAssociationElementInput =
  ModelerElementInput<Partial<BpmnDataAssociationElementData>> & {
    source?: ModelerEdgeEndpoint
    target?: ModelerEdgeEndpoint
    waypoints?: Array<ModelerEdgeWaypoint>
    dataAssociationType?: BpmnDataAssociationType
  }
