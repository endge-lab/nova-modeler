import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_DATA_STORE_DEFAULT_HEIGHT,
  BPMN_DATA_STORE_DEFAULT_WIDTH,
  BPMN_DATA_STORE_TYPE,
  createBpmnDataStoreElement,
} from '@/elements/bpmn/data/data-store/bpmn-data-store.factory'
import { createBpmnDataStorePorts } from '@/elements/bpmn/data/data-store/bpmn-data-store.ports'
import { BpmnDataVariantProvider } from '@/elements/bpmn/data/bpmn-data.variants'
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
  variantProvider: BpmnDataVariantProvider as ModelerElementDefinition<BpmnDataStoreElement>['variantProvider'],
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
