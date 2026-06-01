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

export const MODELER_BPMN_VALIDATION_DIALOG_TYPE = 'modeler-bpmn-validation'
export const MODELER_BPMN_VALIDATION_DIALOG_WIDTH = 760
export const MODELER_BPMN_VALIDATION_DIALOG_HEIGHT = 520
export const MODELER_BPMN_VALIDATION_DIALOG_MIN_WIDTH = 620
export const MODELER_BPMN_VALIDATION_DIALOG_MIN_HEIGHT = 420

export interface BpmnValidationDialogProps {
  type?: string
  title?: string
  description?: string
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  modal?: boolean
  backdrop?: boolean
  closeButton?: boolean
  draggable?: boolean
  resizable?: boolean
}

export interface BpmnValidationDialogResolvedProps extends Required<BpmnValidationDialogProps> {}

export interface BpmnValidationDialogPayload extends Record<string, unknown> {
  result?: ModelerValidationResult
}
