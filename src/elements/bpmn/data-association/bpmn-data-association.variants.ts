import type {
  ModelerElementVariantProvider,
} from '@/domain/types/index'
import {
  BPMN_DATA_ASSOCIATION_TYPE,
  createBpmnDataAssociationElement,
  normalizeBpmnDataAssociationType,
} from '@/elements/bpmn/data-association/bpmn-data-association.factory'
import type {
  BpmnDataAssociationElement,
  BpmnDataAssociationType,
} from '@/elements/bpmn/data-association/bpmn-data-association.types'

const DATA_ASSOCIATION_TYPES: Array<{ id: BpmnDataAssociationType; title: string }> = [
  { id: 'input', title: 'Input association' },
  { id: 'output', title: 'Output association' },
]

export const BpmnDataAssociationVariantProvider: ModelerElementVariantProvider<BpmnDataAssociationElement> = {
  id: 'bpmn.dataAssociation.variants',
  matches: (_context, element): element is BpmnDataAssociationElement => element.type === BPMN_DATA_ASSOCIATION_TYPE,
  createDraft: (_context, element) => ({
    dataAssociationType: normalizeBpmnDataAssociationType(element.data?.dataAssociationType),
  }),
  getDescriptor: (_context, element, draft) => {
    const dataAssociationType = normalizeBpmnDataAssociationType(draft.dataAssociationType ?? element.data?.dataAssociationType)
    return {
      title: 'Change data association',
      controls: [{
        id: 'dataAssociationType',
        kind: 'choice',
        title: 'Data association type',
        value: dataAssociationType,
        options: DATA_ASSOCIATION_TYPES.map(option => ({
          id: option.id,
          title: option.title,
          selected: option.id === dataAssociationType,
          data: { dataAssociationType: option.id },
        })),
      }],
    }
  },
  updateDraft: (_context, element, draft, _control, option) => ({
    ...draft,
    dataAssociationType: normalizeBpmnDataAssociationType(option.data?.dataAssociationType ?? draft.dataAssociationType ?? element.data?.dataAssociationType),
  }),
  apply: ({ context, element, draft, option }) => {
    const dataAssociationType = normalizeBpmnDataAssociationType(option.data?.dataAssociationType ?? draft.dataAssociationType ?? element.data?.dataAssociationType)
    const shouldSwap = dataAssociationType !== element.data?.dataAssociationType
    context.applyCommand({
      type: 'element.replace',
      id: element.id,
      element: createBpmnDataAssociationElement({
        id: element.id,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        zIndex: element.zIndex,
        source: cloneEndpoint(shouldSwap ? element.target : element.source),
        target: cloneEndpoint(shouldSwap ? element.source : element.target),
        waypoints: (shouldSwap ? [...element.waypoints].reverse() : element.waypoints).map(point => ({ ...point })),
        style: { ...element.style },
        data: { ...element.data },
        dataAssociationType,
      }),
    })
  },
}

function cloneEndpoint(endpoint: BpmnDataAssociationElement['source']): BpmnDataAssociationElement['source'] {
  return {
    ...endpoint,
    point: endpoint.point ? { ...endpoint.point } : undefined,
  }
}
