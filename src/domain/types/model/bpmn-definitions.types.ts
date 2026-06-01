export type BpmnGlobalDefinitionKind = 'message' | 'signal' | 'error' | 'escalation'

export interface BpmnGlobalDefinition {
  id: string
  kind: BpmnGlobalDefinitionKind
  name: string
  code?: string
}

export interface BpmnGlobalDefinitionInput {
  id?: string
  kind?: BpmnGlobalDefinitionKind
  name?: string
  code?: string
}
