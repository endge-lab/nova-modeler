import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_PARTICIPANT_DEFAULT_HEIGHT,
  BPMN_PARTICIPANT_DEFAULT_WIDTH,
  BPMN_PARTICIPANT_MIN_HEIGHT,
  BPMN_PARTICIPANT_MIN_WIDTH,
  BPMN_PARTICIPANT_TYPE,
  createBpmnParticipantElement,
  resolveBpmnParticipantPartAt,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import { createBpmnParticipantPorts } from '@/elements/bpmn/participant/bpmn-participant.ports'
import type {
  BpmnParticipantElement,
  BpmnParticipantElementInput,
} from '@/elements/bpmn/participant/bpmn-participant.types'
import { BpmnParticipantVariantProvider } from '@/elements/bpmn/participant/bpmn-participant.variants'

export const BpmnParticipantDefinition: ModelerElementDefinition<BpmnParticipantElement> = {
  type: BPMN_PARTICIPANT_TYPE,
  kind: 'node',
  renderBand: 'containers',
  title: 'Swimlane',
  defaults: {
    width: BPMN_PARTICIPANT_DEFAULT_WIDTH,
    height: BPMN_PARTICIPANT_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: {
      handles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
      minWidth: BPMN_PARTICIPANT_MIN_WIDTH,
      minHeight: BPMN_PARTICIPANT_MIN_HEIGHT,
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
    id: 'create:bpmn.swimlane',
    actionId: 'element.create.bpmn.swimlane',
    shortcutId: 'bpmn.swimlane.create',
    title: 'Swimlane',
    palette: {
      id: 'bpmn.swimlane.create',
      group: 'elements',
      order: 134,
      icon: 'bpmn-swimlane',
    },
    create: input => createBpmnParticipantElement(input as BpmnParticipantElementInput),
  },
  variantProvider: BpmnParticipantVariantProvider,
  normalize: element => createBpmnParticipantElement(element as BpmnParticipantElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnParticipantView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnParticipantPorts(element),
  hitTest: (_context, element, localPoint) => containsRectPoint(element, localPoint),
  hitTestPart: (_context, element, localPoint) => {
    const part = resolveBpmnParticipantPartAt(element, localPoint)
    return part ? { type: 'element-part', id: element.id, ...part } : null
  },
  getTooltip: (_context, element) => element.data?.name ?? 'Participant',
}

function containsRectPoint(element: BpmnParticipantElement, point: ModelerPoint): boolean {
  return point.x >= element.x
    && point.x <= element.x + element.width
    && point.y >= element.y
    && point.y <= element.y + element.height
}
