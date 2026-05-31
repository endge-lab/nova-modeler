import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_GATEWAY_TYPE,
  normalizeBpmnGatewayType,
} from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import type {
  BpmnGatewayElement,
  BpmnGatewayType,
} from '@/elements/bpmn/gateway/bpmn-gateway.types'

export interface BpmnGatewayVariantData extends Record<string, unknown> {
  gatewayType: BpmnGatewayType
}

const GATEWAY_TYPES: Array<{ id: BpmnGatewayType; title: string }> = [
  { id: 'exclusive', title: 'Exclusive gateway' },
  { id: 'parallel', title: 'Parallel gateway' },
  { id: 'inclusive', title: 'Inclusive gateway' },
  { id: 'complex', title: 'Complex gateway' },
  { id: 'eventBased', title: 'Event-based gateway' },
  { id: 'parallelEventBased', title: 'Parallel event-based gateway' },
]

export const BpmnGatewayVariantProvider: ModelerElementVariantProvider<BpmnGatewayElement> = {
  id: 'bpmn.gateway.variants',
  matches: (_context, element): element is BpmnGatewayElement => element.type === BPMN_GATEWAY_TYPE,
  createDraft: (_context, element) => ({
    gatewayType: element.data?.gatewayType,
  }),
  getDescriptor: (_context, element, draft) => {
    const data = resolveBpmnGatewayVariantData(draft, element)
    return {
      title: 'Change gateway',
      controls: [
        {
          id: 'gatewayType',
          kind: 'list',
          title: 'Gateway type',
          value: data.gatewayType,
          options: GATEWAY_TYPES.map(type => ({
            id: type.id,
            title: type.title,
            icon: resolveBpmnGatewayTypeIcon(type.id),
            selected: data.gatewayType === type.id,
            data: { gatewayType: type.id },
          })),
        },
      ],
    }
  },
  updateDraft: (_context, element, draft, _control, option) => ({
    ...draft,
    ...resolveBpmnGatewayVariantData(option.data, element),
  }),
  apply: ({ context, element, draft, option }) => {
    const data = resolveBpmnGatewayVariantData({ ...draft, ...(option.data ?? {}) }, element)
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          gatewayType: data.gatewayType,
        },
      },
    })
  },
}

export function resolveBpmnGatewayTypeIcon(gatewayType: BpmnGatewayType) {
  if (gatewayType === 'parallel') return MODELER_ASSETS.icons.gatewayParallel
  if (gatewayType === 'inclusive') return MODELER_ASSETS.icons.gatewayInclusive
  if (gatewayType === 'complex') return MODELER_ASSETS.icons.gatewayComplex
  if (gatewayType === 'eventBased') return MODELER_ASSETS.icons.gatewayEventBased
  if (gatewayType === 'parallelEventBased') return MODELER_ASSETS.icons.gatewayParallelEventBased
  return MODELER_ASSETS.icons.gatewayExclusive
}

export function resolveBpmnGatewayVariantData(
  data: unknown,
  element?: BpmnGatewayElement,
): BpmnGatewayVariantData {
  const maybeData = typeof data === 'object' && data !== null ? data as Partial<BpmnGatewayVariantData> : {}
  return {
    gatewayType: normalizeBpmnGatewayType(maybeData.gatewayType ?? element?.data?.gatewayType),
  }
}
