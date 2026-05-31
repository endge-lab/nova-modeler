import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  ModelerElementVariantDraft,
  ModelerElementVariantOption,
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_EVENT_TYPE,
} from '@/elements/bpmn/event/bpmn-event.factory'
import type {
  BpmnEventDirection,
  BpmnEventElement,
  BpmnEventPosition,
  BpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.types'

export interface BpmnEventVariantData extends Record<string, unknown> {
  eventPosition: BpmnEventPosition
  trigger: BpmnEventTrigger
  direction?: BpmnEventDirection
}

export const BPMN_EVENT_POSITIONS: Array<{ id: BpmnEventPosition; title: string }> = [
  { id: 'start', title: 'Start' },
  { id: 'intermediate', title: 'Intermediate' },
  { id: 'end', title: 'End' },
]

export const BpmnEventVariantProvider: ModelerElementVariantProvider<BpmnEventElement> = {
  id: 'bpmn.event.variants',
  matches: (_context, element): element is BpmnEventElement => element.type === BPMN_EVENT_TYPE,
  createDraft: (_context, element) => ({
    eventPosition: element.data?.eventPosition,
    trigger: element.data?.trigger,
    direction: element.data?.direction,
  }),
  getDescriptor: (_context, element, draft) => {
    const data = element.data ?? { eventPosition: 'start' as const, trigger: 'none' as const }
    const eventPosition = resolveEventPosition(draft.eventPosition, data.eventPosition)
    const trigger = resolveTrigger(draft.trigger, data.trigger)
    return {
      title: 'Change event',
      controls: [
        {
          id: 'eventPosition',
          kind: 'choice',
          title: 'Event type',
          value: eventPosition,
          options: BPMN_EVENT_POSITIONS.map(position => ({
            id: position.id,
            title: position.title,
            selected: eventPosition === position.id,
            icon: resolveBpmnEventTriggerIcon(trigger),
            data: normalizeBpmnEventVariant(position.id, trigger, resolveDirection(draft.direction, data.direction)),
          })),
        },
        {
          id: 'trigger',
          kind: 'list',
          title: 'Trigger',
          value: `${eventPosition}:${trigger}:${resolveDirection(draft.direction, data.direction) ?? ''}`,
          options: createBpmnEventVariantOptions(eventPosition, element, draft),
        },
      ],
    }
  },
  updateDraft: (_context, element, draft, control, option) => {
    if (control.id !== 'eventPosition') return draft
    return { ...draft, ...resolveBpmnEventVariantData(option.data, draft, element) }
  },
  apply: ({ context, element, draft, option }) => {
    const data = resolveBpmnEventVariantData(option.data, draft, element)
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          eventPosition: data.eventPosition,
          trigger: data.trigger,
          direction: data.direction,
        },
      },
    })
  },
}

export function createBpmnEventVariantOptions(
  eventPosition: BpmnEventPosition,
  element?: BpmnEventElement,
  draft: ModelerElementVariantDraft = {},
): Array<ModelerElementVariantOption> {
  const options = resolveBpmnEventTriggers(eventPosition)
  const currentPosition = resolveEventPosition(draft.eventPosition, element?.data?.eventPosition)
  const currentTrigger = resolveTrigger(draft.trigger, element?.data?.trigger)
  const currentDirection = resolveDirection(draft.direction, element?.data?.direction)

  return options.map(option => ({
    id: option.id,
    title: option.title,
    icon: resolveBpmnEventTriggerIcon(option.trigger),
    selected:
      currentPosition === option.eventPosition &&
      currentTrigger === option.trigger &&
      (currentDirection ?? defaultDirection(currentPosition)) === (option.direction ?? defaultDirection(option.eventPosition)),
    data: {
      eventPosition: option.eventPosition,
      trigger: option.trigger,
      direction: option.direction ?? defaultDirection(option.eventPosition),
    },
  }))
}

export function resolveBpmnEventVariantData(
  data: unknown,
  draft: ModelerElementVariantDraft = {},
  element?: BpmnEventElement,
): BpmnEventVariantData {
  const maybeData = typeof data === 'object' && data !== null ? data as Partial<BpmnEventVariantData> : {}
  const eventPosition = resolveEventPosition(maybeData.eventPosition, draft.eventPosition ?? element?.data?.eventPosition)
  const trigger = resolveTrigger(maybeData.trigger, draft.trigger ?? element?.data?.trigger)
  const direction = resolveDirection(maybeData.direction, draft.direction ?? element?.data?.direction)
  return normalizeBpmnEventVariant(eventPosition, trigger, direction)
}

export function resolveBpmnEventTriggerIcon(trigger: BpmnEventTrigger) {
  if (trigger === 'message') return MODELER_ASSETS.icons.message
  if (trigger === 'timer') return MODELER_ASSETS.icons.timer
  if (trigger === 'error') return MODELER_ASSETS.icons.error
  if (trigger === 'escalation') return MODELER_ASSETS.icons.escalation
  if (trigger === 'cancel') return MODELER_ASSETS.icons.cancel
  if (trigger === 'compensation') return MODELER_ASSETS.icons.compensation
  if (trigger === 'conditional') return MODELER_ASSETS.icons.conditional
  if (trigger === 'link') return MODELER_ASSETS.icons.link
  if (trigger === 'signal') return MODELER_ASSETS.icons.signal
  if (trigger === 'terminate') return MODELER_ASSETS.icons.terminate
  if (trigger === 'multiple') return MODELER_ASSETS.icons.multiple
  if (trigger === 'parallelMultiple') return MODELER_ASSETS.icons.parallelMultiple
  return undefined
}

function resolveBpmnEventTriggers(eventPosition: BpmnEventPosition): Array<BpmnEventVariantData & { id: string; title: string }> {
  if (eventPosition === 'start') {
    return [
      variant('start', 'none', 'Start event'),
      variant('start', 'message', 'Message start event', 'catch'),
      variant('start', 'timer', 'Timer start event', 'catch'),
      variant('start', 'conditional', 'Conditional start event', 'catch'),
      variant('start', 'signal', 'Signal start event', 'catch'),
      variant('start', 'multiple', 'Multiple start event', 'catch'),
      variant('start', 'parallelMultiple', 'Parallel multiple start event', 'catch'),
    ]
  }

  if (eventPosition === 'end') {
    return [
      variant('end', 'none', 'End event'),
      variant('end', 'message', 'Message end event', 'throw'),
      variant('end', 'error', 'Error end event', 'throw'),
      variant('end', 'escalation', 'Escalation end event', 'throw'),
      variant('end', 'cancel', 'Cancel end event', 'throw'),
      variant('end', 'compensation', 'Compensation end event', 'throw'),
      variant('end', 'signal', 'Signal end event', 'throw'),
      variant('end', 'terminate', 'Terminate end event', 'throw'),
      variant('end', 'multiple', 'Multiple end event', 'throw'),
    ]
  }

  return [
    variant('intermediate', 'none', 'Intermediate event', 'catch'),
    variant('intermediate', 'message', 'Message intermediate catch event', 'catch'),
    variant('intermediate', 'message', 'Message intermediate throw event', 'throw'),
    variant('intermediate', 'timer', 'Timer intermediate event', 'catch'),
    variant('intermediate', 'conditional', 'Conditional intermediate event', 'catch'),
    variant('intermediate', 'link', 'Link intermediate catch event', 'catch'),
    variant('intermediate', 'link', 'Link intermediate throw event', 'throw'),
    variant('intermediate', 'signal', 'Signal intermediate catch event', 'catch'),
    variant('intermediate', 'signal', 'Signal intermediate throw event', 'throw'),
    variant('intermediate', 'escalation', 'Escalation intermediate throw event', 'throw'),
    variant('intermediate', 'compensation', 'Compensation intermediate throw event', 'throw'),
    variant('intermediate', 'multiple', 'Multiple intermediate event', 'catch'),
    variant('intermediate', 'parallelMultiple', 'Parallel multiple intermediate event', 'catch'),
  ]
}

function normalizeBpmnEventVariant(
  eventPosition: BpmnEventPosition,
  trigger: BpmnEventTrigger,
  direction?: BpmnEventDirection,
): BpmnEventVariantData {
  const variants = resolveBpmnEventTriggers(eventPosition)
  const exact = variants.find(option => option.trigger === trigger && (option.direction ?? defaultDirection(option.eventPosition)) === (direction ?? defaultDirection(eventPosition)))
  const compatible = exact ?? variants.find(option => option.trigger === trigger)
  return {
    eventPosition,
    trigger: compatible?.trigger ?? 'none',
    direction: compatible?.direction ?? defaultDirection(eventPosition),
  }
}

function variant(
  eventPosition: BpmnEventPosition,
  trigger: BpmnEventTrigger,
  title: string,
  direction?: BpmnEventDirection,
): BpmnEventVariantData & { id: string; title: string } {
  return {
    id: `${eventPosition}:${trigger}:${direction ?? defaultDirection(eventPosition) ?? 'none'}`,
    eventPosition,
    trigger,
    direction,
    title,
  }
}

function resolveEventPosition(value: unknown, fallback: unknown): BpmnEventPosition {
  return value === 'intermediate' || value === 'end' || value === 'start'
    ? value
    : fallback === 'intermediate' || fallback === 'end' || fallback === 'start'
      ? fallback
      : 'start'
}

function resolveTrigger(value: unknown, fallback: unknown): BpmnEventTrigger {
  const candidate = typeof value === 'string' ? value : typeof fallback === 'string' ? fallback : 'none'
  return [
    'none',
    'message',
    'timer',
    'error',
    'escalation',
    'cancel',
    'compensation',
    'conditional',
    'link',
    'signal',
    'terminate',
    'multiple',
    'parallelMultiple',
  ].includes(candidate)
    ? candidate as BpmnEventTrigger
    : 'none'
}

function resolveDirection(value: unknown, fallback: unknown): BpmnEventDirection | undefined {
  if (value === 'catch' || value === 'throw') return value
  if (fallback === 'catch' || fallback === 'throw') return fallback
  return undefined
}

function defaultDirection(eventPosition: BpmnEventPosition): BpmnEventDirection | undefined {
  if (eventPosition === 'end') return 'throw'
  if (eventPosition === 'intermediate') return 'catch'
  if (eventPosition === 'start') return 'catch'
  return undefined
}
