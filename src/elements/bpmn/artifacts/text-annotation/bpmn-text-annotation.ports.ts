import type { BpmnTextAnnotationElement } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.types'
import { createBpmnRectPorts } from '@/elements/bpmn/shared/bpmn-rect-ports'

export function createBpmnTextAnnotationPorts(element: BpmnTextAnnotationElement) {
  return createBpmnRectPorts(element)
}
