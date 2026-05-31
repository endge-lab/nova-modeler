import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_TEXT_ANNOTATION_DEFAULT_HEIGHT,
  BPMN_TEXT_ANNOTATION_DEFAULT_WIDTH,
  BPMN_TEXT_ANNOTATION_MIN_HEIGHT,
  BPMN_TEXT_ANNOTATION_MIN_WIDTH,
  BPMN_TEXT_ANNOTATION_TYPE,
  createBpmnTextAnnotationElement,
} from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.factory'
import { createBpmnTextAnnotationPorts } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.ports'
import { BpmnTextAnnotationVariantProvider } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.variants'
import type {
  BpmnTextAnnotationElement,
  BpmnTextAnnotationElementInput,
} from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.types'

export const BpmnTextAnnotationDefinition: ModelerElementDefinition<BpmnTextAnnotationElement> = {
  type: BPMN_TEXT_ANNOTATION_TYPE,
  kind: 'node',
  title: 'Text annotation',
  defaults: {
    width: BPMN_TEXT_ANNOTATION_DEFAULT_WIDTH,
    height: BPMN_TEXT_ANNOTATION_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: {
      handles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
      minWidth: BPMN_TEXT_ANNOTATION_MIN_WIDTH,
      minHeight: BPMN_TEXT_ANNOTATION_MIN_HEIGHT,
    },
    ports: false,
    connectable: {
      incoming: true,
      outgoing: true,
    },
    cursor: {
      body: 'default',
      hover: 'move',
      drag: 'grabbing',
    },
  },
  createTool: {
    id: 'create:bpmn.text-annotation',
    actionId: 'element.create.bpmn.text-annotation',
    shortcutId: 'bpmn.text-annotation.create',
    title: 'Text annotation',
    palette: {
      id: 'bpmn.text-annotation.create',
      group: 'elements',
      order: 130,
      icon: 'bpmn-text-annotation',
    },
    create: input => createBpmnTextAnnotationElement(input as BpmnTextAnnotationElementInput),
  },
  variantProvider: BpmnTextAnnotationVariantProvider,
  normalize: element => createBpmnTextAnnotationElement(element as BpmnTextAnnotationElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnTextAnnotationView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnTextAnnotationPorts(element),
  hitTest: (_context, element, localPoint) => containsRectPoint(element, localPoint),
  getTooltip: (_context, element) => element.data?.text ?? 'Text annotation',
}

function containsRectPoint(element: BpmnTextAnnotationElement, point: ModelerPoint): boolean {
  return point.x >= element.x
    && point.x <= element.x + element.width
    && point.y >= element.y
    && point.y <= element.y + element.height
}
