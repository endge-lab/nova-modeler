import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnGatewayType =
  | 'exclusive'
  | 'parallel'
  | 'inclusive'
  | 'complex'
  | 'eventBased'
  | 'parallelEventBased'

export interface BpmnGatewayElementData extends Record<string, unknown> {
  gatewayType: BpmnGatewayType
}

export type BpmnGatewayElement = ModelerElement<BpmnGatewayElementData>

export type BpmnGatewayElementInput =
  ModelerElementInput<Partial<BpmnGatewayElementData>> & {
    gatewayType?: BpmnGatewayType
  }
