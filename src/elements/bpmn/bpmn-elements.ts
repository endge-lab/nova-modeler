import type { ModelerElementDefinition } from '@/domain/types/index'
import { BpmnEventDefinition } from '@/elements/bpmn/event/bpmn-event.definition'

export const BpmnElementDefinitions: Array<ModelerElementDefinition> = [
  BpmnEventDefinition,
]
