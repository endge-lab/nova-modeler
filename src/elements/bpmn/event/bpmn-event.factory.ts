import type { BpmnEventElement, BpmnEventElementInput } from '@/elements/bpmn/event/bpmn-event.types'

export const BPMN_EVENT_TYPE = 'bpmn.event'

export const BPMN_EVENT_DEFAULT_SIZE = 48

export function createBpmnEventElement(input: BpmnEventElementInput): BpmnEventElement {
  const data = input.data ?? {}
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
      eventPosition: input.eventPosition ?? data.eventPosition ?? 'start',
      trigger: input.trigger ?? data.trigger ?? 'none',
    },
    style: input.style ? { ...input.style } : {},
  }
}
