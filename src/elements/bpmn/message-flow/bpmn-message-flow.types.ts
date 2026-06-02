import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElementInput,
  ModelerExternalLabelGeometry,
} from '@/domain/types/index'

export interface BpmnMessageFlowElementData extends Record<string, unknown> {
  name?: string
  messageRef?: string
  label?: ModelerExternalLabelGeometry
}

export type BpmnMessageFlowElement = ModelerEdgeElement<BpmnMessageFlowElementData>

export type BpmnMessageFlowElementInput =
  ModelerElementInput<Partial<BpmnMessageFlowElementData>> & {
    source?: ModelerEdgeEndpoint
    target?: ModelerEdgeEndpoint
    waypoints?: Array<ModelerEdgeWaypoint>
    name?: string
    messageRef?: string
    label?: ModelerExternalLabelGeometry
  }
