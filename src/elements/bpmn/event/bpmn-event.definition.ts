import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_EVENT_DEFAULT_SIZE,
  BPMN_EVENT_TYPE,
  createBpmnEventElement,
} from '@/elements/bpmn/event/bpmn-event.factory'
import { createBpmnEventPorts } from '@/elements/bpmn/event/bpmn-event.ports'
import { BpmnEventVariantProvider } from '@/elements/bpmn/event/bpmn-event.variants'
import type {
  BpmnEventElement,
  BpmnEventElementInput,
} from '@/elements/bpmn/event/bpmn-event.types'

export const BpmnEventDefinition: ModelerElementDefinition<BpmnEventElement> = {
  type: BPMN_EVENT_TYPE,
  kind: 'node',
  title: 'Event',
  defaults: {
    width: BPMN_EVENT_DEFAULT_SIZE,
    height: BPMN_EVENT_DEFAULT_SIZE,
  },
  capabilities: {
    selectable: true,
    draggable: true,
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
    id: 'create:bpmn.event',
    actionId: 'element.create.bpmn.event',
    shortcutId: 'bpmn.event.create',
    title: 'Start event',
    palette: {
      id: 'bpmn.event.create',
      group: 'elements',
      order: 110,
      icon: 'bpmn-event-start',
    },
    shortcuts: [{ key: 'e' }],
    create: input => createBpmnEventElement({
      ...(input as BpmnEventElementInput),
      eventPosition: 'start',
      trigger: 'none',
      direction: 'catch',
    }),
  },
  createTools: [
    {
      id: 'create:bpmn.event.intermediate',
      actionId: 'element.create.bpmn.event.intermediate',
      shortcutId: 'bpmn.event.intermediate.create',
      title: 'Intermediate event',
      palette: {
        id: 'bpmn.event.intermediate.create',
        group: 'elements',
        order: 111,
        icon: 'bpmn-event-intermediate',
      },
      shortcuts: [{ key: 'i', shift: true }],
      create: input => createBpmnEventElement({
        ...(input as BpmnEventElementInput),
        eventPosition: 'intermediate',
        trigger: 'none',
        direction: 'catch',
      }),
    },
    {
      id: 'create:bpmn.event.end',
      actionId: 'element.create.bpmn.event.end',
      shortcutId: 'bpmn.event.end.create',
      title: 'End event',
      palette: {
        id: 'bpmn.event.end.create',
        group: 'elements',
        order: 112,
        icon: 'bpmn-event-end',
      },
      shortcuts: [{ key: 'e', shift: true }],
      create: input => createBpmnEventElement({
        ...(input as BpmnEventElementInput),
        eventPosition: 'end',
        trigger: 'none',
        direction: 'throw',
      }),
    },
  ],
  variantProvider: BpmnEventVariantProvider,
  normalize: element => createBpmnEventElement(element as BpmnEventElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnEventView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnEventPorts(element),
  hitTest: (_context, element, localPoint) => containsBpmnEventPoint(element, localPoint),
  getTooltip: (_context, element) => resolveBpmnEventTooltip(element),
}

function resolveBpmnEventTooltip(element: BpmnEventElement): string {
  if (element.data?.eventPosition === 'end') return 'End event'
  if (element.data?.eventPosition === 'intermediate') return 'Intermediate event'
  return 'Start event'
}

function containsBpmnEventPoint(element: BpmnEventElement, point: ModelerPoint): boolean {
  const radius = Math.min(element.width, element.height) / 2
  const centerX = element.x + element.width / 2
  const centerY = element.y + element.height / 2
  const dx = point.x - centerX
  const dy = point.y - centerY
  return dx * dx + dy * dy <= radius * radius
}
