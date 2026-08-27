import type { BpmnEventNameLayout } from '@/elements/bpmn/event/bpmn-event.label'
import {

  containsBpmnEventNameLayoutPoint,
  resolveBpmnEventNameLayout,
} from '@/elements/bpmn/event/bpmn-event.label'

export type BpmnGatewayNameLayout = BpmnEventNameLayout

export function resolveBpmnGatewayNameLayout(input: {
  name?: string
  width: number
  height: number
}): BpmnGatewayNameLayout {
  return resolveBpmnEventNameLayout(input)
}

export function containsBpmnGatewayNameLayoutPoint(layout: BpmnGatewayNameLayout, point: { x: number, y: number }): boolean {
  return containsBpmnEventNameLayoutPoint(layout, point)
}
