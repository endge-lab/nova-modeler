import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElementInput,
  ModelerExternalLabelGeometry,
} from '@/domain/types/index'

export type BpmnDataAssociationType = 'input' | 'output'

export interface BpmnDataAssociationElementData extends Record<string, unknown> {
  associationType: 'directed'
  dataAssociationType: BpmnDataAssociationType
  name?: string
  label?: ModelerExternalLabelGeometry
}

export type BpmnDataAssociationElement = ModelerEdgeElement<BpmnDataAssociationElementData>

export type BpmnDataAssociationElementInput =
  ModelerElementInput<Partial<BpmnDataAssociationElementData>> & {
    source?: ModelerEdgeEndpoint
    target?: ModelerEdgeEndpoint
    waypoints?: Array<ModelerEdgeWaypoint>
    dataAssociationType?: BpmnDataAssociationType
    name?: string
    label?: ModelerExternalLabelGeometry
  }
