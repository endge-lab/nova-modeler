import type { ModelerElementDefinition } from '@/domain/types/index'
import { BasicElementDefinitions } from '@/elements/basic/basic-elements'
import { BpmnElementDefinitions } from '@/elements/bpmn/bpmn-elements'

export const ModelerElementDefinitions: Array<ModelerElementDefinition> = [
  ...BasicElementDefinitions,
  ...BpmnElementDefinitions,
]
