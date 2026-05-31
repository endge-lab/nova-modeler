import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  ModelerElementVariantControl,
  ModelerElementVariantDraft,
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_TASK_TYPE,
  normalizeBpmnTaskLoopType,
  normalizeBpmnTaskType,
} from '@/elements/bpmn/task/bpmn-task.factory'
import type {
  BpmnTaskElement,
  BpmnTaskLoopType,
  BpmnTaskType,
} from '@/elements/bpmn/task/bpmn-task.types'

export interface BpmnTaskVariantData extends Record<string, unknown> {
  name: string
  taskType: BpmnTaskType
  loopType: BpmnTaskLoopType
  isForCompensation: boolean
  instantiate?: boolean
}

const HEADER_LOOP_TYPES: Array<{ id: Exclude<BpmnTaskLoopType, 'none'>; title: string }> = [
  { id: 'multiInstanceParallel', title: 'Parallel multi-instance' },
  { id: 'multiInstanceSequential', title: 'Sequential multi-instance' },
  { id: 'standard', title: 'Loop' },
]

const TASK_TYPES: Array<{ id: BpmnTaskType; title: string }> = [
  { id: 'none', title: 'Task' },
  { id: 'user', title: 'User task' },
  { id: 'manual', title: 'Manual task' },
  { id: 'service', title: 'Service task' },
  { id: 'script', title: 'Script task' },
  { id: 'businessRule', title: 'Business rule task' },
  { id: 'send', title: 'Send task' },
  { id: 'receive', title: 'Receive task' },
]

export const BpmnTaskVariantProvider: ModelerElementVariantProvider<BpmnTaskElement> = {
  id: 'bpmn.task.variants',
  matches: (_context, element): element is BpmnTaskElement => element.type === BPMN_TASK_TYPE,
  createDraft: (_context, element) => createDraftFromElement(element),
  getDescriptor: (_context, element, draft) => {
    const data = resolveBpmnTaskVariantData(draft, element)
    const controls: Array<ModelerElementVariantControl> = [
      {
        id: 'taskType',
        kind: 'list',
        title: 'Task type',
        value: data.taskType,
        options: TASK_TYPES.map(type => ({
          id: type.id,
          title: type.title,
          icon: resolveBpmnTaskTypeIcon(type.id),
          selected: data.taskType === type.id,
          data: { taskType: type.id },
        })),
      },
    ]
    return {
      title: 'Change task',
      headerControls: [{
        id: 'loopType',
        kind: 'iconToggle',
        value: data.loopType,
        options: HEADER_LOOP_TYPES.map(type => {
          const selected = data.loopType === type.id
          return {
            id: type.id,
            title: type.title,
            selected,
            data: { loopType: selected ? 'none' : type.id },
          }
        }),
      }],
      controls,
    }
  },
  updateDraft: (_context, element, draft, _control, option) => ({
    ...draft,
    ...resolveBpmnTaskVariantData(option.data, element),
  }),
  apply: ({ context, element, draft, option }) => {
    const data = resolveBpmnTaskVariantData({ ...draft, ...(option.data ?? {}) }, element)
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          name: data.name,
          taskType: data.taskType,
          loopType: data.loopType,
          isForCompensation: data.isForCompensation,
          instantiate: data.taskType === 'receive' ? data.instantiate : undefined,
        },
      },
    })
  },
}

export function resolveBpmnTaskTypeIcon(taskType: BpmnTaskType) {
  if (taskType === 'user') return MODELER_ASSETS.icons.taskUser
  if (taskType === 'manual') return MODELER_ASSETS.icons.taskManual
  if (taskType === 'service') return MODELER_ASSETS.icons.taskService
  if (taskType === 'script') return MODELER_ASSETS.icons.taskScript
  if (taskType === 'businessRule') return MODELER_ASSETS.icons.taskBusinessRule
  if (taskType === 'send') return MODELER_ASSETS.icons.taskSend
  if (taskType === 'receive') return MODELER_ASSETS.icons.taskReceive
  return undefined
}

export function resolveBpmnTaskVariantData(
  data: unknown,
  element?: BpmnTaskElement,
): BpmnTaskVariantData {
  const maybeData = typeof data === 'object' && data !== null ? data as Partial<BpmnTaskVariantData> : {}
  const fallback = element?.data
  const taskType = normalizeBpmnTaskType(maybeData.taskType ?? fallback?.taskType)
  return {
    name: normalizeName(maybeData.name ?? fallback?.name),
    taskType,
    loopType: normalizeBpmnTaskLoopType(maybeData.loopType ?? fallback?.loopType),
    isForCompensation: (maybeData.isForCompensation ?? fallback?.isForCompensation) === true,
    instantiate: taskType === 'receive'
      ? (maybeData.instantiate ?? fallback?.instantiate) === true
      : undefined,
  }
}

function createDraftFromElement(element: BpmnTaskElement): ModelerElementVariantDraft {
  return {
    name: element.data?.name,
    taskType: element.data?.taskType,
    loopType: element.data?.loopType,
    isForCompensation: element.data?.isForCompensation,
    instantiate: element.data?.instantiate,
  }
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Task'
}
