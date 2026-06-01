import type { ModelerElementDefinition } from '@/domain/types/index'
import { BpmnGroupDefinition } from '@/elements/bpmn/artifacts/group/bpmn-group.definition'
import { BpmnTextAnnotationDefinition } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.definition'
import { BpmnAssociationDefinition } from '@/elements/bpmn/association/bpmn-association.definition'
import { BpmnBoundaryEventDefinition } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.definition'
import { BpmnDataObjectDefinition } from '@/elements/bpmn/data/data-object/bpmn-data-object.definition'
import { BpmnDataStoreDefinition } from '@/elements/bpmn/data/data-store/bpmn-data-store.definition'
import { BpmnDataAssociationDefinition } from '@/elements/bpmn/data-association/bpmn-data-association.definition'
import { BpmnEventDefinition } from '@/elements/bpmn/event/bpmn-event.definition'
import { BpmnFlowDefinition } from '@/elements/bpmn/flow/bpmn-flow.definition'
import { BpmnGatewayDefinition } from '@/elements/bpmn/gateway/bpmn-gateway.definition'
import { BpmnCallActivityDefinition } from '@/elements/bpmn/call-activity/bpmn-call-activity.definition'
import { BpmnMessageFlowDefinition } from '@/elements/bpmn/message-flow/bpmn-message-flow.definition'
import { BpmnParticipantDefinition } from '@/elements/bpmn/participant/bpmn-participant.definition'
import { BpmnSubProcessDefinition } from '@/elements/bpmn/sub-process/bpmn-sub-process.definition'
import { BpmnTaskDefinition } from '@/elements/bpmn/task/bpmn-task.definition'

export const BpmnElementDefinitions: Array<ModelerElementDefinition> = [
  BpmnFlowDefinition,
  BpmnAssociationDefinition,
  BpmnMessageFlowDefinition,
  BpmnDataAssociationDefinition,
  BpmnEventDefinition,
  BpmnBoundaryEventDefinition,
  BpmnGatewayDefinition,
  BpmnTaskDefinition,
  BpmnSubProcessDefinition,
  BpmnCallActivityDefinition,
  BpmnTextAnnotationDefinition,
  BpmnGroupDefinition,
  BpmnDataObjectDefinition,
  BpmnDataStoreDefinition,
  BpmnParticipantDefinition,
]
