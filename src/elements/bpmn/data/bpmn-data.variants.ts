import type {
  ModelerElementVariantDescriptor,
  ModelerElementVariantProvider,
} from '@/domain/types/index'
import {
  BPMN_DATA_OBJECT_TYPE,
  createBpmnDataObjectElement,
  normalizeBpmnDataObjectType,
} from '@/elements/bpmn/data/data-object/bpmn-data-object.factory'
import type {
  BpmnDataObjectElement,
  BpmnDataObjectType,
} from '@/elements/bpmn/data/data-object/bpmn-data-object.types'
import {
  BPMN_DATA_STORE_TYPE,
  createBpmnDataStoreElement,
} from '@/elements/bpmn/data/data-store/bpmn-data-store.factory'
import type { BpmnDataStoreElement } from '@/elements/bpmn/data/data-store/bpmn-data-store.types'

export type BpmnDataKind = BpmnDataObjectType | 'store'
export type BpmnDataElement = BpmnDataObjectElement | BpmnDataStoreElement

const DATA_KINDS: Array<{ id: BpmnDataKind; title: string }> = [
  { id: 'object', title: 'Data object' },
  { id: 'input', title: 'Data input' },
  { id: 'output', title: 'Data output' },
  { id: 'store', title: 'Data store' },
]

export function resolveBpmnDataKind(element: BpmnDataElement): BpmnDataKind {
  if (element.type === BPMN_DATA_STORE_TYPE) return 'store'
  return normalizeBpmnDataObjectType(element.data?.dataObjectType)
}

export function createBpmnDataVariantElement(element: BpmnDataElement, kind: BpmnDataKind): BpmnDataElement {
  const name = resolveBpmnDataName(element, kind)
  const common = {
    id: element.id,
    x: element.x,
    y: element.y,
    rotation: element.rotation,
    zIndex: element.zIndex,
    style: element.style ? { ...element.style } : undefined,
  }
  if (kind === 'store') {
    return createBpmnDataStoreElement({
      ...common,
      name,
    })
  }
  return createBpmnDataObjectElement({
    ...common,
    name,
    dataObjectType: kind,
    isCollection: element.type === BPMN_DATA_OBJECT_TYPE
      ? element.data?.isCollection === true
      : false,
  })
}

export const BpmnDataVariantProvider: ModelerElementVariantProvider<BpmnDataElement> = {
  id: 'bpmn.data.variants',
  matches: (_context, element): element is BpmnDataElement =>
    element.type === BPMN_DATA_OBJECT_TYPE || element.type === BPMN_DATA_STORE_TYPE,
  createDraft: (_context, element) => ({
    dataKind: resolveBpmnDataKind(element),
    isCollection: element.type === BPMN_DATA_OBJECT_TYPE ? element.data?.isCollection === true : false,
  }),
  getDescriptor: (_context, element, draft): ModelerElementVariantDescriptor => {
    const kind = normalizeBpmnDataKind(draft.dataKind ?? resolveBpmnDataKind(element))
    const isCollection = (draft.isCollection ?? (element.type === BPMN_DATA_OBJECT_TYPE ? element.data?.isCollection : false)) === true
    return {
      title: 'Change data',
      headerControls: kind === 'store'
        ? []
        : [{
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
        id: 'dataKind',
        kind: 'list',
        title: 'Data type',
        value: kind,
        options: DATA_KINDS.map(option => ({
          id: option.id,
          title: option.title,
          selected: option.id === kind,
          data: { dataKind: option.id },
        })),
      }],
    }
  },
  updateDraft: (_context, element, draft, _control, option) => ({
    dataKind: normalizeBpmnDataKind(option.data?.dataKind ?? draft.dataKind ?? resolveBpmnDataKind(element)),
    isCollection: (option.data?.isCollection ?? draft.isCollection ?? (element.type === BPMN_DATA_OBJECT_TYPE ? element.data?.isCollection : false)) === true,
  }),
  apply: ({ context, element, draft, option }) => {
    const kind = normalizeBpmnDataKind(option.data?.dataKind ?? draft.dataKind ?? resolveBpmnDataKind(element))
    const isCollection = (option.data?.isCollection ?? draft.isCollection ?? (element.type === BPMN_DATA_OBJECT_TYPE ? element.data?.isCollection : false)) === true

    if (kind === 'store') {
      context.applyCommand({
        type: 'element.replace',
        id: element.id,
        element: createBpmnDataVariantElement(element, 'store'),
      })
      return
    }

    if (element.type === BPMN_DATA_OBJECT_TYPE) {
      context.applyCommand({
        type: 'element.patch',
        id: element.id,
        patch: {
          data: {
            ...element.data,
            dataObjectType: kind,
            isCollection,
          },
        },
      })
      return
    }

    context.applyCommand({
      type: 'element.replace',
      id: element.id,
      element: createBpmnDataObjectElement({
        id: element.id,
        x: element.x,
        y: element.y,
        rotation: element.rotation,
        zIndex: element.zIndex,
        style: element.style ? { ...element.style } : undefined,
        name: resolveBpmnDataName(element, kind),
        dataObjectType: kind,
        isCollection,
      }),
    })
  },
}

export function normalizeBpmnDataKind(value: unknown): BpmnDataKind {
  return value === 'store' ? 'store' : normalizeBpmnDataObjectType(value)
}

function resolveBpmnDataName(element: BpmnDataElement, kind: BpmnDataKind): string {
  const name = element.data?.name
  if (typeof name === 'string' && name.trim().length > 0) return name
  return kind === 'store' ? 'Data store' : 'Data object'
}
