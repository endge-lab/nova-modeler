import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_DATA_STORE_DEFAULT_HEIGHT,
  BPMN_DATA_STORE_DEFAULT_WIDTH,
  BPMN_DATA_STORE_MIN_HEIGHT,
  BPMN_DATA_STORE_MIN_WIDTH,
  BPMN_DATA_STORE_TYPE,
  createBpmnDataStoreElement,
} from '@/elements/bpmn/data/data-store/bpmn-data-store.factory'
import { createBpmnDataStorePorts } from '@/elements/bpmn/data/data-store/bpmn-data-store.ports'
import type {
  BpmnDataStoreElement,
  BpmnDataStoreElementInput,
} from '@/elements/bpmn/data/data-store/bpmn-data-store.types'

export const BpmnDataStoreDefinition: ModelerElementDefinition<BpmnDataStoreElement> = {
  type: BPMN_DATA_STORE_TYPE,
  kind: 'node',
  title: 'Data store',
  defaults: {
    width: BPMN_DATA_STORE_DEFAULT_WIDTH,
    height: BPMN_DATA_STORE_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: {
      handles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
      minWidth: BPMN_DATA_STORE_MIN_WIDTH,
      minHeight: BPMN_DATA_STORE_MIN_HEIGHT,
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
    id: 'create:bpmn.data-store',
    actionId: 'element.create.bpmn.data-store',
    shortcutId: 'bpmn.data-store.create',
    title: 'Data store',
    palette: {
      id: 'bpmn.data-store.create',
      group: 'elements',
      order: 145,
      icon: 'bpmn-data-store',
    },
    create: input => createBpmnDataStoreElement(input as BpmnDataStoreElementInput),
  },
  normalize: element => createBpmnDataStoreElement(element as BpmnDataStoreElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnDataStoreView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnDataStorePorts(element),
  hitTest: (_context, element, localPoint) => containsRectPoint(element, localPoint),
  getTooltip: (_context, element) => element.data?.name ?? 'Data store',
}

function containsRectPoint(element: BpmnDataStoreElement, point: ModelerPoint): boolean {
  return point.x >= element.x
    && point.x <= element.x + element.width
    && point.y >= element.y
    && point.y <= element.y + element.height
}
