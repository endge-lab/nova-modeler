import type { BpmnGroupElement } from '@/elements/bpmn/artifacts/group/bpmn-group.types'
import { createBpmnRectPorts } from '@/elements/bpmn/shared/bpmn-rect-ports'

export function createBpmnGroupPorts(element: BpmnGroupElement) {
  return createBpmnRectPorts(element)
}
