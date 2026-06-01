import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import { BpmnActivityVariantProvider } from '@/elements/bpmn/activity/bpmn-activity.variants'
import {
  BPMN_CALL_ACTIVITY_DEFAULT_HEIGHT,
  BPMN_CALL_ACTIVITY_DEFAULT_WIDTH,
  BPMN_CALL_ACTIVITY_MIN_HEIGHT,
  BPMN_CALL_ACTIVITY_MIN_WIDTH,
  BPMN_CALL_ACTIVITY_TYPE,
  createBpmnCallActivityElement,
} from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import { createBpmnCallActivityPorts } from '@/elements/bpmn/call-activity/bpmn-call-activity.ports'
import type {
  BpmnCallActivityElement,
  BpmnCallActivityElementInput,
} from '@/elements/bpmn/call-activity/bpmn-call-activity.types'

export const BpmnCallActivityDefinition: ModelerElementDefinition<BpmnCallActivityElement> = {
  type: BPMN_CALL_ACTIVITY_TYPE,
  kind: 'node',
  title: 'Call activity',
  defaults: {
    width: BPMN_CALL_ACTIVITY_DEFAULT_WIDTH,
    height: BPMN_CALL_ACTIVITY_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: {
      handles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
      minWidth: BPMN_CALL_ACTIVITY_MIN_WIDTH,
      minHeight: BPMN_CALL_ACTIVITY_MIN_HEIGHT,
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
  variantProvider: BpmnActivityVariantProvider as ModelerElementDefinition<BpmnCallActivityElement>['variantProvider'],
  normalize: element => createBpmnCallActivityElement(element as BpmnCallActivityElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnActivityView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnCallActivityPorts(element),
  hitTest: (_context, element, localPoint) => containsRectPoint(element, localPoint),
  getTooltip: () => 'Call activity',
}

function containsRectPoint(element: BpmnCallActivityElement, point: ModelerPoint): boolean {
  return point.x >= element.x
    && point.x <= element.x + element.width
    && point.y >= element.y
    && point.y <= element.y + element.height
}
