import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_DATA_OBJECT_DEFAULT_HEIGHT,
  BPMN_DATA_OBJECT_DEFAULT_WIDTH,
  BPMN_DATA_OBJECT_TYPE,
  createBpmnDataObjectElement,
} from '@/elements/bpmn/data/data-object/bpmn-data-object.factory'
import { createBpmnDataObjectPorts } from '@/elements/bpmn/data/data-object/bpmn-data-object.ports'
import { BpmnDataVariantProvider } from '@/elements/bpmn/data/bpmn-data.variants'
import type {
  BpmnDataObjectElement,
  BpmnDataObjectElementInput,
} from '@/elements/bpmn/data/data-object/bpmn-data-object.types'

export const BpmnDataObjectDefinition: ModelerElementDefinition<BpmnDataObjectElement> = {
  type: BPMN_DATA_OBJECT_TYPE,
  kind: 'node',
  title: 'Data',
  defaults: {
    width: BPMN_DATA_OBJECT_DEFAULT_WIDTH,
    height: BPMN_DATA_OBJECT_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: false,
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
    id: 'create:bpmn.data',
    actionId: 'element.create.bpmn.data',
    shortcutId: 'bpmn.data.create',
    title: 'Data',
    palette: {
      id: 'bpmn.data.create',
      group: 'elements',
      order: 140,
      icon: 'bpmn-data-object',
    },
    create: input => createBpmnDataObjectElement(input as BpmnDataObjectElementInput),
  },
  variantProvider: BpmnDataVariantProvider as ModelerElementDefinition<BpmnDataObjectElement>['variantProvider'],
  normalize: element => createBpmnDataObjectElement(element as BpmnDataObjectElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnDataObjectView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnDataObjectPorts(element),
  hitTest: (_context, element, localPoint) => containsRectPoint(element, localPoint),
  getTooltip: (_context, element) => element.data?.name ?? 'Data object',
}

function containsRectPoint(element: BpmnDataObjectElement, point: ModelerPoint): boolean {
  return point.x >= element.x
    && point.x <= element.x + element.width
    && point.y >= element.y
    && point.y <= element.y + element.height
}
