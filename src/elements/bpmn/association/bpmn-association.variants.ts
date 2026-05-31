import type {
  ModelerElementVariantDescriptor,
  ModelerElementVariantProvider,
} from '@/domain/types/index'
import {
  BPMN_ASSOCIATION_TYPE,
  normalizeBpmnAssociationType,
} from '@/elements/bpmn/association/bpmn-association.factory'
import type {
  BpmnAssociationElement,
  BpmnAssociationType,
} from '@/elements/bpmn/association/bpmn-association.types'

const ASSOCIATION_TYPES: Array<{ id: BpmnAssociationType; title: string }> = [
  { id: 'undirected', title: 'Association' },
  { id: 'directed', title: 'Directed association' },
  { id: 'bidirectional', title: 'Bidirectional association' },
  { id: 'data', title: 'Data association' },
]

export const BpmnAssociationVariantProvider: ModelerElementVariantProvider<BpmnAssociationElement> = {
  id: 'bpmn.association.variants',
  matches: (_context, element): element is BpmnAssociationElement => element.type === BPMN_ASSOCIATION_TYPE,
  createDraft: (_context, element) => ({
    associationType: normalizeBpmnAssociationType(element.data?.associationType),
  }),
  getDescriptor(_context, _element, draft): ModelerElementVariantDescriptor {
    const value = normalizeBpmnAssociationType(draft.associationType)
    return {
      title: 'Association type',
      controls: [{
        id: 'associationType',
        kind: 'list',
        title: 'Association type',
        value,
        options: ASSOCIATION_TYPES.map(option => ({
          id: option.id,
          title: option.title,
          selected: option.id === value,
          data: { associationType: option.id },
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
          associationType: normalizeBpmnAssociationType(option.data?.associationType ?? option.id),
        },
      },
    })
  },
}
