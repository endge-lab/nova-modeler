import { createBpmnRectPorts } from '@/elements/bpmn/shared/bpmn-rect-ports'
import type { BpmnGroupElement } from '@/elements/bpmn/artifacts/group/bpmn-group.types'

export function createBpmnGroupPorts(element: BpmnGroupElement) {
  return createBpmnRectPorts(element)
}
