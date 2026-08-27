import type { BpmnDataStoreElement } from '@/elements/bpmn/data/data-store/bpmn-data-store.types'
import { createBpmnRectPorts } from '@/elements/bpmn/shared/bpmn-rect-ports'

export function createBpmnDataStorePorts(element: BpmnDataStoreElement) {
  return createBpmnRectPorts(element)
}
