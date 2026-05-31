import type {
  ModelerElementVariantDescriptor,
  ModelerElementVariantProvider,
} from '@/domain/types/index'
import {
  BPMN_FLOW_TYPE,
  normalizeBpmnFlowType,
} from '@/elements/bpmn/flow/bpmn-flow.factory'
import type {
  BpmnFlowElement,
  BpmnFlowType,
} from '@/elements/bpmn/flow/bpmn-flow.types'

const FLOW_TYPES: Array<{ id: BpmnFlowType; title: string; description: string }> = [
  { id: 'sequence', title: 'Sequence', description: 'Regular BPMN sequence flow.' },
  { id: 'conditionalSequence', title: 'Conditional sequence', description: 'Sequence flow with a condition marker.' },
  { id: 'defaultSequence', title: 'Default sequence', description: 'Default outgoing sequence flow.' },
]

export const BpmnFlowVariantProvider: ModelerElementVariantProvider<BpmnFlowElement> = {
  id: 'bpmn.flow.variants',
  matches: (_context, element): element is BpmnFlowElement => element.type === BPMN_FLOW_TYPE,
  createDraft: (_context, element) => ({
    flowType: normalizeBpmnFlowType(element.data?.flowType),
  }),
  getDescriptor(_context, _element, draft): ModelerElementVariantDescriptor {
    const value = normalizeBpmnFlowType(draft.flowType)
    return {
      title: 'Flow type',
      controls: [{
        id: 'flowType',
        kind: 'list',
        title: 'Flow type',
        value,
        options: FLOW_TYPES.map(option => ({
          ...option,
          selected: option.id === value,
        })),
      }],
    }
  },
  apply({ context, element, option }) {
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          flowType: normalizeBpmnFlowType(option.id),
        },
      },
    })
  },
}
