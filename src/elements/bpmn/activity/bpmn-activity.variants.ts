import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  ModelerElementVariantControl,
  ModelerElementVariantDescriptor,
  ModelerElementVariantDraft,
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_CALL_ACTIVITY_TYPE,
  createBpmnCallActivityElement,
} from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import type { BpmnCallActivityElement } from '@/elements/bpmn/call-activity/bpmn-call-activity.types'
import {
  BPMN_SUB_PROCESS_TYPE,
  createBpmnSubProcessElement,
  normalizeBpmnSubProcessType,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import type {
  BpmnSubProcessElement,
  BpmnSubProcessType,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.types'
import {
  BPMN_TASK_TYPE,
  createBpmnTaskElement,
  normalizeBpmnTaskLoopType,
  normalizeBpmnTaskType,
} from '@/elements/bpmn/task/bpmn-task.factory'
import type {
  BpmnTaskElement,
  BpmnTaskLoopType,
  BpmnTaskType,
} from '@/elements/bpmn/task/bpmn-task.types'

export type BpmnActivityKind =
  | 'task'
  | 'subProcess'
  | 'eventSubProcess'
  | 'transaction'
  | 'adHocSubProcess'
  | 'callActivity'

export type BpmnActivityElement = BpmnTaskElement | BpmnSubProcessElement | BpmnCallActivityElement

export interface BpmnActivityVariantData extends Record<string, unknown> {
  activityKind: BpmnActivityKind
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

const ACTIVITY_KINDS: Array<{ id: BpmnActivityKind; title: string }> = [
  { id: 'task', title: 'Task' },
  { id: 'subProcess', title: 'Sub-process' },
  { id: 'eventSubProcess', title: 'Event sub-process' },
  { id: 'transaction', title: 'Transaction' },
  { id: 'adHocSubProcess', title: 'Ad-hoc sub-process' },
  { id: 'callActivity', title: 'Call activity' },
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

export function resolveBpmnActivityKind(element: BpmnActivityElement): BpmnActivityKind {
  if (element.type === BPMN_CALL_ACTIVITY_TYPE) return 'callActivity'
  if (element.type === BPMN_SUB_PROCESS_TYPE) {
    const type = normalizeBpmnSubProcessType(element.data?.subProcessType)
    if (type === 'event') return 'eventSubProcess'
    if (type === 'transaction') return 'transaction'
    if (type === 'adHoc') return 'adHocSubProcess'
    return 'subProcess'
  }
  return 'task'
}

export function createBpmnActivityVariantElement(
  element: BpmnActivityElement,
  kind: BpmnActivityKind,
): BpmnActivityElement {
  const data = resolveBpmnActivityVariantData({ activityKind: kind }, element)
  const common = {
    id: element.id,
    x: element.x,
    y: element.y,
    rotation: element.rotation,
    zIndex: element.zIndex,
    style: element.style ? { ...element.style } : undefined,
  }
  if (kind === 'task') {
    return createBpmnTaskElement({
      ...common,
      name: data.name,
      taskType: data.taskType,
      loopType: data.loopType,
      isForCompensation: data.isForCompensation,
      instantiate: data.instantiate,
    })
  }
  if (kind === 'callActivity') {
    return createBpmnCallActivityElement({
      ...common,
      width: resolveActivityRectWidth(element),
      height: resolveActivityRectHeight(element),
      name: data.name,
      loopType: data.loopType,
      isForCompensation: data.isForCompensation,
    })
  }
  return createBpmnSubProcessElement({
    ...common,
    width: resolveActivityRectWidth(element),
    height: resolveActivityRectHeight(element),
    name: data.name,
    subProcessType: resolveSubProcessType(kind),
    loopType: data.loopType,
    isForCompensation: data.isForCompensation,
  })
}

export const BpmnActivityVariantProvider: ModelerElementVariantProvider<BpmnActivityElement> = {
  id: 'bpmn.activity.variants',
  matches: (_context, element): element is BpmnActivityElement =>
    element.type === BPMN_TASK_TYPE || element.type === BPMN_SUB_PROCESS_TYPE || element.type === BPMN_CALL_ACTIVITY_TYPE,
  createDraft: (_context, element) => createDraftFromElement(element),
  getDescriptor: (_context, element, draft): ModelerElementVariantDescriptor => {
    const data = resolveBpmnActivityVariantData(draft, element)
    const controls: Array<ModelerElementVariantControl> = [{
      id: 'activityKind',
      kind: 'choice',
      title: 'Activity type',
      value: data.activityKind,
      options: ACTIVITY_KINDS.map(kind => ({
        id: kind.id,
        title: kind.title,
        icon: resolveBpmnActivityKindIcon(kind.id),
        selected: data.activityKind === kind.id,
        data: { activityKind: kind.id },
      })),
    }]
    if (data.activityKind === 'task') {
      controls.push({
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
      })
    }
    return {
      title: 'Change activity',
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
  updateDraft: (_context, element, draft, _control, option) => resolveBpmnActivityVariantData({
    ...draft,
    ...(option.data ?? {}),
  }, element),
  apply: ({ context, element, draft, option }) => {
    const data = resolveBpmnActivityVariantData({ ...draft, ...(option.data ?? {}) }, element)
    const currentKind = resolveBpmnActivityKind(element)

    if (data.activityKind === 'task' && element.type === BPMN_TASK_TYPE) {
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
      return
    }

    if (
      element.type === BPMN_SUB_PROCESS_TYPE
      && data.activityKind !== 'task'
      && data.activityKind !== 'callActivity'
    ) {
      context.applyCommand({
        type: 'element.patch',
        id: element.id,
        patch: {
          data: {
            ...element.data,
            name: data.name,
            subProcessType: resolveSubProcessType(data.activityKind),
            loopType: data.loopType,
            isForCompensation: data.isForCompensation,
          },
        },
      })
      return
    }

    if (data.activityKind === currentKind && element.type === BPMN_CALL_ACTIVITY_TYPE) {
      context.applyCommand({
        type: 'element.patch',
        id: element.id,
        patch: {
          data: {
            ...element.data,
            name: data.name,
            loopType: data.loopType,
            isForCompensation: data.isForCompensation,
          },
        },
      })
      return
    }

    context.applyCommand({
      type: 'element.replace',
      id: element.id,
      element: createBpmnActivityVariantElement(element, data.activityKind),
    })
  },
}

export function resolveBpmnActivityKindIcon(kind: BpmnActivityKind) {
  if (kind === 'subProcess') return MODELER_ASSETS.icons.activitySubProcess
  if (kind === 'eventSubProcess') return MODELER_ASSETS.icons.activityEventSubProcess
  if (kind === 'transaction') return MODELER_ASSETS.icons.activityTransaction
  if (kind === 'adHocSubProcess') return MODELER_ASSETS.icons.activityAdHoc
  if (kind === 'callActivity') return MODELER_ASSETS.icons.activityCall
  return MODELER_ASSETS.icons.activity
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

export function resolveBpmnActivityVariantData(
  data: unknown,
  element?: BpmnActivityElement,
): BpmnActivityVariantData {
  const maybeData = typeof data === 'object' && data !== null ? data as Partial<BpmnActivityVariantData> : {}
  const fallback = element?.data
  const taskType = normalizeBpmnTaskType(maybeData.taskType ?? (element?.type === BPMN_TASK_TYPE ? fallback?.taskType : 'none'))
  const activityKind = normalizeBpmnActivityKind(maybeData.activityKind ?? (element ? resolveBpmnActivityKind(element) : 'task'))
  return {
    activityKind,
    name: normalizeName(maybeData.name ?? fallback?.name, activityKind),
    taskType,
    loopType: normalizeBpmnTaskLoopType(maybeData.loopType ?? fallback?.loopType),
    isForCompensation: (maybeData.isForCompensation ?? fallback?.isForCompensation) === true,
    instantiate: taskType === 'receive'
      ? (maybeData.instantiate ?? (element?.type === BPMN_TASK_TYPE ? fallback?.instantiate : false)) === true
      : undefined,
  }
}

export function normalizeBpmnActivityKind(value: unknown): BpmnActivityKind {
  return value === 'subProcess'
    || value === 'eventSubProcess'
    || value === 'transaction'
    || value === 'adHocSubProcess'
    || value === 'callActivity'
    || value === 'task'
    ? value
    : 'task'
}

function createDraftFromElement(element: BpmnActivityElement): ModelerElementVariantDraft {
  return {
    activityKind: resolveBpmnActivityKind(element),
    name: element.data?.name,
    taskType: element.type === BPMN_TASK_TYPE ? element.data?.taskType : 'none',
    loopType: element.data?.loopType,
    isForCompensation: element.data?.isForCompensation,
    instantiate: element.type === BPMN_TASK_TYPE ? element.data?.instantiate : undefined,
  }
}

function resolveSubProcessType(kind: BpmnActivityKind): BpmnSubProcessType {
  if (kind === 'eventSubProcess') return 'event'
  if (kind === 'transaction') return 'transaction'
  if (kind === 'adHocSubProcess') return 'adHoc'
  return 'embedded'
}

function resolveActivityRectWidth(element: BpmnActivityElement): number {
  return element.type === BPMN_TASK_TYPE ? 160 : element.width
}

function resolveActivityRectHeight(element: BpmnActivityElement): number {
  return element.type === BPMN_TASK_TYPE ? 100 : element.height
}

function normalizeName(value: unknown, kind: BpmnActivityKind): string {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (kind === 'callActivity') return 'Call activity'
  if (kind === 'task') return 'Task'
  return 'Sub-process'
}
