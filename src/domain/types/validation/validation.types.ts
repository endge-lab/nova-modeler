export type ModelerValidationStatus = 'valid' | 'invalid'

export type ModelerValidationSeverity = 'error' | 'warning'

export type BpmnValidationRuleId =
  | 'bpmn.noNodes'
  | 'bpmn.noStartEvent'
  | 'bpmn.noEndEvent'
  | 'bpmn.invalidFlowSource'
  | 'bpmn.invalidFlowTarget'
  | 'bpmn.flowToSelf'
  | 'bpmn.startIncoming'
  | 'bpmn.startNoOutgoing'
  | 'bpmn.endOutgoing'
  | 'bpmn.endNoIncoming'
  | 'bpmn.nodeNoIncoming'
  | 'bpmn.nodeNoOutgoing'
  | 'bpmn.instantiateNonReceiveTask'

export interface ModelerValidationIssue {
  id: string
  ruleId: BpmnValidationRuleId
  severity: ModelerValidationSeverity
  message: string
  elementIds: Array<string>
}

export interface ModelerValidationResult {
  status: ModelerValidationStatus
  modelVersion: number
  issues: Array<ModelerValidationIssue>
}
