import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
} from '@/domain/types/index'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'
import {
  BPMN_MESSAGE_FLOW_TYPE,
  createBpmnMessageFlowElement,
} from '@/elements/bpmn/message-flow/bpmn-message-flow.factory'
import { BpmnMessageFlowVariantProvider } from '@/elements/bpmn/message-flow/bpmn-message-flow.variants'
import { createBpmnEdgeExternalLabelAdapter } from '@/elements/bpmn/bpmn-external-label'
import type {
  BpmnMessageFlowElement,
  BpmnMessageFlowElementInput,
} from '@/elements/bpmn/message-flow/bpmn-message-flow.types'

const BPMN_MESSAGE_FLOW_HIT_TOLERANCE = 6

export const BpmnMessageFlowDefinition: ModelerElementDefinition<BpmnMessageFlowElement> = {
  type: BPMN_MESSAGE_FLOW_TYPE,
  kind: 'edge',
  title: 'Message flow',
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
  variantProvider: BpmnMessageFlowVariantProvider,
  externalLabel: createBpmnEdgeExternalLabelAdapter(),
  normalize: element => createBpmnMessageFlowElement(element as BpmnMessageFlowElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnMessageFlowView,
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
    const tolerance = BPMN_MESSAGE_FLOW_HIT_TOLERANCE / context.getViewport().scale
    return MODEL_ELEMENTS_RUNTIME.edges.distanceToPath(point, path) <= tolerance
  },
  getTooltip: () => 'Message flow',
}
