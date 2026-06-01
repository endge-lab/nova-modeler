import type {
  ModelerElementVariantProvider,
} from '@/domain/types/index'
import { BPMN_ASSOCIATION_TYPE } from '@/elements/bpmn/association/bpmn-association.factory'
import {
  applyBpmnConnectionVariant,
  createBpmnConnectionDraft,
  getBpmnConnectionVariantDescriptor,
  updateBpmnConnectionVariantDraft,
} from '@/elements/bpmn/bpmn-connection-variants'
import type {
  BpmnAssociationElement,
} from '@/elements/bpmn/association/bpmn-association.types'

export const BpmnAssociationVariantProvider: ModelerElementVariantProvider<BpmnAssociationElement> = {
  id: 'bpmn.association.variants',
  matches: (_context, element): element is BpmnAssociationElement => element.type === BPMN_ASSOCIATION_TYPE,
  createDraft: (_context, element) => createBpmnConnectionDraft(element),
  getDescriptor: (_context, element, draft) => getBpmnConnectionVariantDescriptor(element, draft),
  updateDraft: (_context, element, draft, control, option) => updateBpmnConnectionVariantDraft(element, draft, control, option),
  apply: applyBpmnConnectionVariant,
}
