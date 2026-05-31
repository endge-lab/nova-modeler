import type { ModelerElementDefinition } from '@/domain/types/index'
import { BpmnGroupDefinition } from '@/elements/bpmn/artifacts/group/bpmn-group.definition'
import { BpmnTextAnnotationDefinition } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.definition'
import { BpmnAssociationDefinition } from '@/elements/bpmn/association/bpmn-association.definition'
import { BpmnDataObjectDefinition } from '@/elements/bpmn/data/data-object/bpmn-data-object.definition'
import { BpmnDataStoreDefinition } from '@/elements/bpmn/data/data-store/bpmn-data-store.definition'
import { BpmnEventDefinition } from '@/elements/bpmn/event/bpmn-event.definition'
import { BpmnFlowDefinition } from '@/elements/bpmn/flow/bpmn-flow.definition'
import { BpmnGatewayDefinition } from '@/elements/bpmn/gateway/bpmn-gateway.definition'
import { BpmnTaskDefinition } from '@/elements/bpmn/task/bpmn-task.definition'

export const BpmnElementDefinitions: Array<ModelerElementDefinition> = [
  BpmnFlowDefinition,
  BpmnAssociationDefinition,
  BpmnEventDefinition,
  BpmnGatewayDefinition,
  BpmnTaskDefinition,
  BpmnTextAnnotationDefinition,
  BpmnGroupDefinition,
  BpmnDataObjectDefinition,
  BpmnDataStoreDefinition,
]
