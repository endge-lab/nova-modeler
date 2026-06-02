import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElementInput,
  ModelerExternalLabelGeometry,
} from '@/domain/types/index'

export type BpmnFlowType = 'sequence' | 'conditionalSequence' | 'defaultSequence'

export interface BpmnFlowElementData extends Record<string, unknown> {
  flowType: BpmnFlowType
  name?: string
  conditionExpression?: string
  label?: ModelerExternalLabelGeometry
}

export type BpmnFlowElement = ModelerEdgeElement<BpmnFlowElementData>

export type BpmnFlowElementInput =
  ModelerElementInput<Partial<BpmnFlowElementData>> & {
    source?: ModelerEdgeEndpoint
    target?: ModelerEdgeEndpoint
    waypoints?: Array<ModelerEdgeWaypoint>
    flowType?: BpmnFlowType
    name?: string
    label?: ModelerExternalLabelGeometry
  }
