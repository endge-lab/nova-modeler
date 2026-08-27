import type {
  ModelerElementVariantProvider,
} from '@/domain/types/index'
import type {
  BpmnFlowElement,
} from '@/elements/bpmn/flow/bpmn-flow.types'
import {
  applyBpmnConnectionVariant,
  createBpmnConnectionDraft,
  getBpmnConnectionVariantDescriptor,
  updateBpmnConnectionVariantDraft,
} from '@/elements/bpmn/bpmn-connection-variants'
import { BPMN_FLOW_TYPE } from '@/elements/bpmn/flow/bpmn-flow.factory'

export const BpmnFlowVariantProvider: ModelerElementVariantProvider<BpmnFlowElement> = {
  id: 'bpmn.flow.variants',
  matches: (_context, element): element is BpmnFlowElement => element.type === BPMN_FLOW_TYPE,
  createDraft: (_context, element) => createBpmnConnectionDraft(element),
  getDescriptor: (_context, element, draft) => getBpmnConnectionVariantDescriptor(element, draft),
  updateDraft: (_context, element, draft, control, option) => updateBpmnConnectionVariantDraft(element, draft, control, option),
  apply: applyBpmnConnectionVariant,
}
