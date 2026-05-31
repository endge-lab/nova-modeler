import { createBpmnRectPorts } from '@/elements/bpmn/shared/bpmn-rect-ports'
import type { BpmnDataObjectElement } from '@/elements/bpmn/data/data-object/bpmn-data-object.types'

export function createBpmnDataObjectPorts(element: BpmnDataObjectElement) {
  return createBpmnRectPorts(element)
}
