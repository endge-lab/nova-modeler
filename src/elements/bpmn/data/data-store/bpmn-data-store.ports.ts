import { createBpmnRectPorts } from '@/elements/bpmn/shared/bpmn-rect-ports'
import type { BpmnDataStoreElement } from '@/elements/bpmn/data/data-store/bpmn-data-store.types'

export function createBpmnDataStorePorts(element: BpmnDataStoreElement) {
  return createBpmnRectPorts(element)
}
