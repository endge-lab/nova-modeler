import { createBpmnRectPorts } from '@/elements/bpmn/shared/bpmn-rect-ports'
import type { BpmnTextAnnotationElement } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.types'

export function createBpmnTextAnnotationPorts(element: BpmnTextAnnotationElement) {
  return createBpmnRectPorts(element)
}
