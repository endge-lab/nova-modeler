import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
} from '@/domain/types/index'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'
import {
  BPMN_DATA_ASSOCIATION_TYPE,
  createBpmnDataAssociationElement,
  normalizeBpmnDataAssociationType,
} from '@/elements/bpmn/data-association/bpmn-data-association.factory'
import { BpmnDataAssociationVariantProvider } from '@/elements/bpmn/data-association/bpmn-data-association.variants'
import type {
  BpmnDataAssociationElement,
  BpmnDataAssociationElementInput,
} from '@/elements/bpmn/data-association/bpmn-data-association.types'

const BPMN_DATA_ASSOCIATION_HIT_TOLERANCE = 6

export const BpmnDataAssociationDefinition: ModelerElementDefinition<BpmnDataAssociationElement> = {
  type: BPMN_DATA_ASSOCIATION_TYPE,
  kind: 'edge',
  title: 'Data association',
  capabilities: {
    selectable: true,
    draggable: false,
    resizable: false,
    rotatable: false,
    ports: false,
    connectable: false,
    colorable: {
      fill: false,
      stroke: true,
      custom: true,
    },
    cursor: {
      body: 'default',
      hover: 'pointer',
    },
  },
  variantProvider: BpmnDataAssociationVariantProvider,
  normalize: element => createBpmnDataAssociationElement(element as BpmnDataAssociationElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnAssociationView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
      path: MODEL_ELEMENTS_RUNTIME.edges.createPath(context, element),
    },
  }),
  hitTest: (context, element, point) => {
    const path = MODEL_ELEMENTS_RUNTIME.edges.createPath(context, element)
    const tolerance = BPMN_DATA_ASSOCIATION_HIT_TOLERANCE / context.getViewport().scale
    return MODEL_ELEMENTS_RUNTIME.edges.distanceToPath(point, path) <= tolerance
  },
  getTooltip: (_context, element) => {
    const type = normalizeBpmnDataAssociationType(element.data?.dataAssociationType)
    return type === 'output' ? 'Data output association' : 'Data input association'
  },
}
