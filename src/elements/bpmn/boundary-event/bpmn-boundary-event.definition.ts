import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_BOUNDARY_EVENT_DEFAULT_SIZE,
  BPMN_BOUNDARY_EVENT_TYPE,
  createBpmnBoundaryEventElement,
} from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import { createBpmnBoundaryEventPorts } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.ports'
import { BpmnBoundaryEventVariantProvider } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.variants'
import type {
  BpmnBoundaryEventElement,
  BpmnBoundaryEventElementInput,
} from '@/elements/bpmn/boundary-event/bpmn-boundary-event.types'

export const BpmnBoundaryEventDefinition: ModelerElementDefinition<BpmnBoundaryEventElement> = {
  type: BPMN_BOUNDARY_EVENT_TYPE,
  kind: 'node',
  title: 'Boundary event',
  defaults: {
    width: BPMN_BOUNDARY_EVENT_DEFAULT_SIZE,
    height: BPMN_BOUNDARY_EVENT_DEFAULT_SIZE,
  },
  capabilities: {
    selectable: true,
    draggable: false,
    ports: false,
    connectable: {
      incoming: false,
      outgoing: true,
    },
    cursor: {
      body: 'default',
      hover: 'default',
      drag: 'default',
    },
  },
  variantProvider: BpmnBoundaryEventVariantProvider,
  normalize: element => createBpmnBoundaryEventElement(element as BpmnBoundaryEventElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnEventView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnBoundaryEventPorts(element),
  hitTest: (_context, element, localPoint) => containsBpmnBoundaryEventPoint(element, localPoint),
  getTooltip: (_context, element) => resolveBpmnBoundaryEventTooltip(element),
}

function resolveBpmnBoundaryEventTooltip(element: BpmnBoundaryEventElement): string {
  const interrupting = element.data?.isInterrupting === false ? 'non-interrupting' : 'interrupting'
  return `${interrupting} boundary event`
}

function containsBpmnBoundaryEventPoint(element: BpmnBoundaryEventElement, point: ModelerPoint): boolean {
  const radius = Math.min(element.width, element.height) / 2
  const centerX = element.x + element.width / 2
  const centerY = element.y + element.height / 2
  const dx = point.x - centerX
  const dy = point.y - centerY
  return dx * dx + dy * dy <= radius * radius
}
