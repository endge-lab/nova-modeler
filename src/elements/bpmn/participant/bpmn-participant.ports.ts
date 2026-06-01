import type { ModelerPort } from '@/domain/types/index'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'

export function createBpmnParticipantPorts(_element: BpmnParticipantElement): Array<ModelerPort> {
  return []
}
