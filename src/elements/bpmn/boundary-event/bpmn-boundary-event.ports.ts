import { createBpmnEventPorts } from '@/elements/bpmn/event/bpmn-event.ports'
import type { BpmnBoundaryEventElement } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.types'

export function createBpmnBoundaryEventPorts(element: BpmnBoundaryEventElement) {
  return createBpmnEventPorts(element)
}
