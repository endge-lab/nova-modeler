import type {
  ModelerElement,
  ModelerElementInput,
  ModelerExternalLabelGeometry,
} from '@/domain/types/index'

export type BpmnGatewayType =
  | 'exclusive'
  | 'parallel'
  | 'inclusive'
  | 'complex'
  | 'eventBased'
  | 'parallelEventBased'

export interface BpmnGatewayElementData extends Record<string, unknown> {
  name: string
  gatewayType: BpmnGatewayType
  label?: ModelerExternalLabelGeometry
}

export type BpmnGatewayElement = ModelerElement<BpmnGatewayElementData>

export type BpmnGatewayElementInput =
  ModelerElementInput<Partial<BpmnGatewayElementData>> & {
    name?: string
    gatewayType?: BpmnGatewayType
    label?: ModelerExternalLabelGeometry
  }
