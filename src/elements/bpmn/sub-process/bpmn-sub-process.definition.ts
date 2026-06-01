import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import { BpmnActivityVariantProvider } from '@/elements/bpmn/activity/bpmn-activity.variants'
import {
  BPMN_SUB_PROCESS_DEFAULT_HEIGHT,
  BPMN_SUB_PROCESS_DEFAULT_WIDTH,
  BPMN_SUB_PROCESS_MIN_HEIGHT,
  BPMN_SUB_PROCESS_MIN_WIDTH,
  BPMN_SUB_PROCESS_TYPE,
  createBpmnSubProcessElement,
  normalizeBpmnSubProcessType,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import { createBpmnSubProcessPorts } from '@/elements/bpmn/sub-process/bpmn-sub-process.ports'
import type {
  BpmnSubProcessElement,
  BpmnSubProcessElementInput,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.types'

export const BpmnSubProcessDefinition: ModelerElementDefinition<BpmnSubProcessElement> = {
  type: BPMN_SUB_PROCESS_TYPE,
  kind: 'node',
  title: 'Sub-process',
  defaults: {
    width: BPMN_SUB_PROCESS_DEFAULT_WIDTH,
    height: BPMN_SUB_PROCESS_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: {
      handles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
      minWidth: BPMN_SUB_PROCESS_MIN_WIDTH,
      minHeight: BPMN_SUB_PROCESS_MIN_HEIGHT,
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
  variantProvider: BpmnActivityVariantProvider as ModelerElementDefinition<BpmnSubProcessElement>['variantProvider'],
  normalize: element => createBpmnSubProcessElement(element as BpmnSubProcessElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnActivityView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnSubProcessPorts(element),
  hitTest: (_context, element, localPoint) => containsRectPoint(element, localPoint),
  getTooltip: (_context, element) => resolveBpmnSubProcessTooltip(element),
}

function resolveBpmnSubProcessTooltip(element: BpmnSubProcessElement): string {
  const type = normalizeBpmnSubProcessType(element.data?.subProcessType)
  if (type === 'event') return 'Event sub-process'
  if (type === 'transaction') return 'Transaction'
  if (type === 'adHoc') return 'Ad-hoc sub-process'
  return 'Sub-process'
}

function containsRectPoint(element: BpmnSubProcessElement, point: ModelerPoint): boolean {
  return point.x >= element.x
    && point.x <= element.x + element.width
    && point.y >= element.y
    && point.y <= element.y + element.height
}
