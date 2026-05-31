import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_GROUP_DEFAULT_HEIGHT,
  BPMN_GROUP_DEFAULT_WIDTH,
  BPMN_GROUP_MIN_HEIGHT,
  BPMN_GROUP_MIN_WIDTH,
  BPMN_GROUP_TYPE,
  createBpmnGroupElement,
} from '@/elements/bpmn/artifacts/group/bpmn-group.factory'
import { createBpmnGroupPorts } from '@/elements/bpmn/artifacts/group/bpmn-group.ports'
import type {
  BpmnGroupElement,
  BpmnGroupElementInput,
} from '@/elements/bpmn/artifacts/group/bpmn-group.types'

export const BpmnGroupDefinition: ModelerElementDefinition<BpmnGroupElement> = {
  type: BPMN_GROUP_TYPE,
  kind: 'node',
  title: 'Group',
  defaults: {
    width: BPMN_GROUP_DEFAULT_WIDTH,
    height: BPMN_GROUP_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: {
      handles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
      minWidth: BPMN_GROUP_MIN_WIDTH,
      minHeight: BPMN_GROUP_MIN_HEIGHT,
    },
    ports: false,
    connectable: false,
    cursor: {
      body: 'default',
      hover: 'move',
      drag: 'grabbing',
    },
  },
  createTool: {
    id: 'create:bpmn.group',
    actionId: 'element.create.bpmn.group',
    shortcutId: 'bpmn.group.create',
    title: 'Group',
    palette: {
      id: 'bpmn.group.create',
      group: 'elements',
      order: 132,
      icon: 'bpmn-group',
    },
    create: input => createBpmnGroupElement(input as BpmnGroupElementInput),
  },
  normalize: element => createBpmnGroupElement(element as BpmnGroupElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnGroupView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnGroupPorts(element),
  hitTest: (_context, element, localPoint) => containsRectPoint(element, localPoint),
  getTooltip: (_context, element) => element.data?.name ?? 'Group',
}

function containsRectPoint(element: BpmnGroupElement, point: ModelerPoint): boolean {
  return point.x >= element.x
    && point.x <= element.x + element.width
    && point.y >= element.y
    && point.y <= element.y + element.height
}
