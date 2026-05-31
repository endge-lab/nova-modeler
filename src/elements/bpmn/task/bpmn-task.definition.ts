import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_TASK_DEFAULT_HEIGHT,
  BPMN_TASK_DEFAULT_WIDTH,
  BPMN_TASK_TYPE,
  createBpmnTaskElement,
} from '@/elements/bpmn/task/bpmn-task.factory'
import { createBpmnTaskPorts } from '@/elements/bpmn/task/bpmn-task.ports'
import { BpmnTaskVariantProvider } from '@/elements/bpmn/task/bpmn-task.variants'
import type {
  BpmnTaskElement,
  BpmnTaskElementInput,
} from '@/elements/bpmn/task/bpmn-task.types'

export const BpmnTaskDefinition: ModelerElementDefinition<BpmnTaskElement> = {
  type: BPMN_TASK_TYPE,
  kind: 'node',
  title: 'Task',
  defaults: {
    width: BPMN_TASK_DEFAULT_WIDTH,
    height: BPMN_TASK_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: false,
    ports: {
      visible: 'selected',
      strategy: 'definition',
    },
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
    id: 'create:bpmn.task',
    actionId: 'element.create.bpmn.task',
    shortcutId: 'bpmn.task.create',
    title: 'Task',
    palette: {
      id: 'bpmn.task.create',
      group: 'elements',
      order: 120,
      icon: 'bpmn-task',
    },
    shortcuts: [{ key: 't' }],
    create: input => createBpmnTaskElement(input as BpmnTaskElementInput),
  },
  variantProvider: BpmnTaskVariantProvider,
  normalize: element => createBpmnTaskElement(element as BpmnTaskElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnTaskView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnTaskPorts(element),
  hitTest: (_context, element, localPoint) => containsBpmnTaskPoint(element, localPoint),
  getTooltip: (_context, element) => resolveBpmnTaskTooltip(element),
}

function resolveBpmnTaskTooltip(element: BpmnTaskElement): string {
  const taskType = element.data?.taskType
  if (taskType === 'user') return 'User task'
  if (taskType === 'manual') return 'Manual task'
  if (taskType === 'service') return 'Service task'
  if (taskType === 'script') return 'Script task'
  if (taskType === 'businessRule') return 'Business rule task'
  if (taskType === 'send') return 'Send task'
  if (taskType === 'receive') return 'Receive task'
  return 'Task'
}

function containsBpmnTaskPoint(element: BpmnTaskElement, point: ModelerPoint): boolean {
  return point.x >= element.x
    && point.x <= element.x + element.width
    && point.y >= element.y
    && point.y <= element.y + element.height
}
