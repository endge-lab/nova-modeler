import type {
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerEdgeWaypoint,
  ModelerElementInput,
} from '@/domain/types/index'

export interface BpmnMessageFlowElementData extends Record<string, unknown> {
  messageRef?: string
}

export type BpmnMessageFlowElement = ModelerEdgeElement<BpmnMessageFlowElementData>

export type BpmnMessageFlowElementInput =
  ModelerElementInput<Partial<BpmnMessageFlowElementData>> & {
    source?: ModelerEdgeEndpoint
    target?: ModelerEdgeEndpoint
    waypoints?: Array<ModelerEdgeWaypoint>
    messageRef?: string
  }
