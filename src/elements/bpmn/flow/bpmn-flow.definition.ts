import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'
import {
  BPMN_FLOW_TYPE,
  createBpmnFlowElement,
  normalizeBpmnFlowType,
} from '@/elements/bpmn/flow/bpmn-flow.factory'
import { BpmnFlowVariantProvider } from '@/elements/bpmn/flow/bpmn-flow.variants'
import { createBpmnEdgeExternalLabelAdapter } from '@/elements/bpmn/bpmn-external-label'
import type {
  BpmnFlowElement,
  BpmnFlowElementInput,
} from '@/elements/bpmn/flow/bpmn-flow.types'

const BPMN_FLOW_HIT_TOLERANCE = 6

export const BpmnFlowDefinition: ModelerElementDefinition<BpmnFlowElement> = {
  type: BPMN_FLOW_TYPE,
  kind: 'edge',
  title: 'Sequence flow',
  capabilities: {
    selectable: true,
    draggable: false,
    resizable: false,
    rotatable: false,
    ports: false,
    connectable: false,
    cursor: {
      body: 'default',
      hover: 'pointer',
    },
  },
  variantProvider: BpmnFlowVariantProvider,
  externalLabel: createBpmnEdgeExternalLabelAdapter(),
  normalize: element => createBpmnFlowElement(element as BpmnFlowElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnFlowView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
      path: MODEL_ELEMENTS_RUNTIME.edges.createPath(context, element),
      hideName: true,
    },
  }),
  hitTest: (context, element, point) => {
    const path = MODEL_ELEMENTS_RUNTIME.edges.createPath(context, element)
    const tolerance = BPMN_FLOW_HIT_TOLERANCE / context.getViewport().scale
    return MODEL_ELEMENTS_RUNTIME.edges.distanceToPath(point, path) <= tolerance
  },
  getTooltip: (_context, element) => resolveBpmnFlowTooltip(element),
}

export function createBpmnFlowEndpoint(elementId: string, portId: string, point: ModelerPoint) {
  return {
    elementId,
    portId,
    point: { ...point },
  }
}

function resolveBpmnFlowTooltip(element: BpmnFlowElement): string {
  const flowType = normalizeBpmnFlowType(element.data?.flowType)
  if (flowType === 'conditionalSequence') return 'Conditional sequence flow'
  if (flowType === 'defaultSequence') return 'Default sequence flow'
  return 'Sequence flow'
}
