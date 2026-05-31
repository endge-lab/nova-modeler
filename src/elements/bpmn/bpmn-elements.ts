import type { ModelerElementDefinition } from '@/domain/types/index'
import { BpmnEventDefinition } from '@/elements/bpmn/event/bpmn-event.definition'
import { BpmnFlowDefinition } from '@/elements/bpmn/flow/bpmn-flow.definition'
import { BpmnGatewayDefinition } from '@/elements/bpmn/gateway/bpmn-gateway.definition'
import { BpmnTaskDefinition } from '@/elements/bpmn/task/bpmn-task.definition'

export const BpmnElementDefinitions: Array<ModelerElementDefinition> = [
  BpmnFlowDefinition,
  BpmnEventDefinition,
  BpmnGatewayDefinition,
  BpmnTaskDefinition,
]
