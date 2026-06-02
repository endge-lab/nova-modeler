import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
} from '@/domain/types/index'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'
import {
  BPMN_ASSOCIATION_TYPE,
  createBpmnAssociationElement,
  normalizeBpmnAssociationType,
} from '@/elements/bpmn/association/bpmn-association.factory'
import { BpmnAssociationVariantProvider } from '@/elements/bpmn/association/bpmn-association.variants'
import { createBpmnEdgeExternalLabelAdapter } from '@/elements/bpmn/bpmn-external-label'
import type {
  BpmnAssociationElement,
  BpmnAssociationElementInput,
} from '@/elements/bpmn/association/bpmn-association.types'

const BPMN_ASSOCIATION_HIT_TOLERANCE = 6

export const BpmnAssociationDefinition: ModelerElementDefinition<BpmnAssociationElement> = {
  type: BPMN_ASSOCIATION_TYPE,
  kind: 'edge',
  title: 'Association',
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
  createTool: {
    id: 'create:bpmn.association',
    actionId: 'element.create.bpmn.association',
    shortcutId: 'bpmn.association.create',
    title: 'Association',
    palette: {
      id: 'bpmn.association.create',
      group: 'tools',
      order: 30,
      icon: 'bpmn-association',
    },
    create: input => createBpmnAssociationElement(input as BpmnAssociationElementInput),
  },
  variantProvider: BpmnAssociationVariantProvider,
  externalLabel: createBpmnEdgeExternalLabelAdapter(),
  normalize: element => createBpmnAssociationElement(element as BpmnAssociationElementInput),
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
    const tolerance = BPMN_ASSOCIATION_HIT_TOLERANCE / context.getViewport().scale
    return MODEL_ELEMENTS_RUNTIME.edges.distanceToPath(point, path) <= tolerance
  },
  getTooltip: (_context, element) => resolveBpmnAssociationTooltip(element),
}

function resolveBpmnAssociationTooltip(element: BpmnAssociationElement): string {
  const associationType = normalizeBpmnAssociationType(element.data?.associationType)
  if (associationType === 'directed') return 'Directed association'
  if (associationType === 'bidirectional') return 'Bidirectional association'
  if (associationType === 'data') return 'Data association'
  return 'Association'
}
