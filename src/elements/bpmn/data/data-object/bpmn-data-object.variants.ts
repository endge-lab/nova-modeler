import type {
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_DATA_OBJECT_TYPE,
  normalizeBpmnDataObjectType,
} from '@/elements/bpmn/data/data-object/bpmn-data-object.factory'
import type {
  BpmnDataObjectElement,
  BpmnDataObjectType,
} from '@/elements/bpmn/data/data-object/bpmn-data-object.types'

const DATA_OBJECT_TYPES: Array<{ id: BpmnDataObjectType; title: string }> = [
  { id: 'object', title: 'Data object' },
  { id: 'input', title: 'Data input' },
  { id: 'output', title: 'Data output' },
]

export const BpmnDataObjectVariantProvider: ModelerElementVariantProvider<BpmnDataObjectElement> = {
  id: 'bpmn.dataObject.variants',
  matches: (_context, element): element is BpmnDataObjectElement => element.type === BPMN_DATA_OBJECT_TYPE,
  createDraft: (_context, element) => ({
    dataObjectType: element.data?.dataObjectType,
    isCollection: element.data?.isCollection,
  }),
  getDescriptor: (_context, element, draft) => {
    const type = normalizeBpmnDataObjectType(draft.dataObjectType ?? element.data?.dataObjectType)
    const isCollection = (draft.isCollection ?? element.data?.isCollection) === true
    return {
      title: 'Change data object',
      headerControls: [{
        id: 'isCollection',
        kind: 'iconToggle',
        value: isCollection ? 'collection' : 'single',
        options: [{
          id: 'collection',
          title: 'Collection',
          selected: isCollection,
          data: { isCollection: !isCollection },
        }],
      }],
      controls: [{
        id: 'dataObjectType',
        kind: 'list',
        title: 'Data object type',
        value: type,
        options: DATA_OBJECT_TYPES.map(option => ({
          id: option.id,
          title: option.title,
          selected: option.id === type,
          data: { dataObjectType: option.id },
        })),
      }],
    }
  },
  apply: ({ context, element, draft, option }) => {
    const nextType = normalizeBpmnDataObjectType(option.data?.dataObjectType ?? draft.dataObjectType ?? element.data?.dataObjectType)
    const isCollection = (option.data?.isCollection ?? draft.isCollection ?? element.data?.isCollection) === true
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          dataObjectType: nextType,
          isCollection,
        },
      },
    })
  },
}
