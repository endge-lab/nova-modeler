import type {
  BpmnEventDirection,
  BpmnEventElement,
  BpmnEventElementInput,
  BpmnEventPosition,
  BpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.types'

export const BPMN_EVENT_TYPE = 'bpmn.event'

export const BPMN_EVENT_DEFAULT_SIZE = 48

export interface BpmnEventVariantData extends Record<string, unknown> {
  eventPosition: BpmnEventPosition
  trigger: BpmnEventTrigger
  direction: BpmnEventDirection
}

export const BPMN_EVENT_POSITIONS: Array<{ id: BpmnEventPosition; title: string }> = [
  { id: 'start', title: 'Start' },
  { id: 'intermediate', title: 'Intermediate' },
  { id: 'end', title: 'End' },
]

export function createBpmnEventElement(input: BpmnEventElementInput): BpmnEventElement {
  const data = input.data ?? {}
  const eventData = normalizeBpmnEventVariantData(
    input.eventPosition ?? data.eventPosition,
    input.trigger ?? data.trigger,
    input.direction ?? data.direction,
  )
  return {
    id: input.id,
    type: BPMN_EVENT_TYPE,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? BPMN_EVENT_DEFAULT_SIZE,
    height: input.height ?? BPMN_EVENT_DEFAULT_SIZE,
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      name: normalizeOptionalName(input.name ?? data.name),
      eventPosition: eventData.eventPosition,
      trigger: eventData.trigger,
      direction: eventData.direction,
      messageRef: normalizeOptionalRef(input.messageRef ?? data.messageRef),
      signalRef: normalizeOptionalRef(input.signalRef ?? data.signalRef),
      errorRef: normalizeOptionalRef(input.errorRef ?? data.errorRef),
      escalationRef: normalizeOptionalRef(input.escalationRef ?? data.escalationRef),
    },
    style: input.style ? { ...input.style } : {},
  }
}

function normalizeOptionalName(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeOptionalRef(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function resolveBpmnEventVariants(eventPosition: BpmnEventPosition): Array<BpmnEventVariantData & { id: string; title: string }> {
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

export function normalizeBpmnEventVariantData(
  eventPosition: unknown,
  trigger: unknown,
  direction?: unknown,
): BpmnEventVariantData {
  const position = normalizeBpmnEventPosition(eventPosition)
  const normalizedTrigger = normalizeBpmnEventTrigger(trigger)
  const normalizedDirection = normalizeBpmnEventDirection(direction, defaultBpmnEventDirection(position))
  const variants = resolveBpmnEventVariants(position)
  const exact = variants.find(option =>
    option.trigger === normalizedTrigger &&
    option.direction === normalizedDirection,
  )
  const compatible = exact ?? variants.find(option => option.trigger === normalizedTrigger)
  return {
    eventPosition: position,
    trigger: compatible?.trigger ?? 'none',
    direction: compatible?.direction ?? defaultBpmnEventDirection(position),
  }
}

export function normalizeBpmnEventPosition(value: unknown, fallback: BpmnEventPosition = 'start'): BpmnEventPosition {
  if (value === 'start' || value === 'intermediate' || value === 'end') return value
  return fallback
}

export function normalizeBpmnEventTrigger(value: unknown, fallback: BpmnEventTrigger = 'none'): BpmnEventTrigger {
  const candidate = typeof value === 'string' ? value : fallback
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
    : fallback
}

export function normalizeBpmnEventDirection(value: unknown, fallback: BpmnEventDirection = 'catch'): BpmnEventDirection {
  if (value === 'catch' || value === 'throw') return value
  return fallback
}

export function defaultBpmnEventDirection(eventPosition: BpmnEventPosition): BpmnEventDirection {
  return eventPosition === 'end' ? 'throw' : 'catch'
}

function variant(
  eventPosition: BpmnEventPosition,
  trigger: BpmnEventTrigger,
  title: string,
  direction: BpmnEventDirection = defaultBpmnEventDirection(eventPosition),
): BpmnEventVariantData & { id: string; title: string } {
  return {
    id: `${eventPosition}:${trigger}:${direction}`,
    eventPosition,
    trigger,
    direction,
    title,
  }
}
