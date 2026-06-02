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
import {
  containsBpmnEventNameLayoutPoint,
  resolveBpmnEventNameLayout,
} from '@/elements/bpmn/event/bpmn-event.label'
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
    title: 'Event',
    palette: {
      id: 'bpmn.event.create',
      group: 'elements',
      order: 110,
      icon: 'bpmn-event',
    },
    shortcuts: [{ key: 'e' }],
    create: input => createBpmnEventElement({
      ...(input as BpmnEventElementInput),
      eventPosition: 'start',
      trigger: 'none',
      direction: 'catch',
    }),
  },
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
  if (element.data?.name) return element.data.name
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
  if (dx * dx + dy * dy <= radius * radius) return true
  const layout = resolveBpmnEventNameLayout({
    name: element.data?.name,
    width: element.width,
    height: element.height,
  })
  return containsBpmnEventNameLayoutPoint(layout, { x: dx, y: dy })
}
