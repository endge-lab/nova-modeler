import type {
  BpmnGatewayElement,
  BpmnGatewayElementInput,
  BpmnGatewayType,
} from '@/elements/bpmn/gateway/bpmn-gateway.types'
import { normalizeExternalLabelGeometry } from '@/tools/external-label-geometry'

export const BPMN_GATEWAY_TYPE = 'bpmn.gateway'
export const BPMN_GATEWAY_DEFAULT_SIZE = 56

export function createBpmnGatewayElement(input: BpmnGatewayElementInput): BpmnGatewayElement {
  const data = input.data ?? {}
  return {
    id: input.id,
    type: BPMN_GATEWAY_TYPE,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? BPMN_GATEWAY_DEFAULT_SIZE,
    height: input.height ?? BPMN_GATEWAY_DEFAULT_SIZE,
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      name: normalizeName(input.name ?? data.name),
      gatewayType: normalizeBpmnGatewayType(input.gatewayType ?? data.gatewayType),
      label: normalizeExternalLabelGeometry(input.label ?? data.label),
    },
    style: input.style ? { ...input.style } : {},
  }
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeBpmnGatewayType(value: unknown): BpmnGatewayType {
  return value === 'parallel'
    || value === 'inclusive'
    || value === 'complex'
    || value === 'eventBased'
    || value === 'parallelEventBased'
    || value === 'exclusive'
    ? value
    : 'exclusive'
}
