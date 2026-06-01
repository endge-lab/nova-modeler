import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  ModelerElementVariantDraft,
  ModelerElementVariantOption,
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_EVENT_POSITIONS,
  BPMN_EVENT_TYPE,
  defaultBpmnEventDirection,
  normalizeBpmnEventDirection,
  normalizeBpmnEventPosition,
  normalizeBpmnEventTrigger,
  normalizeBpmnEventVariantData,
  resolveBpmnEventVariants,
  type BpmnEventVariantData,
} from '@/elements/bpmn/event/bpmn-event.factory'
import type {
  BpmnEventElement,
  BpmnEventPosition,
  BpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.types'
import {
  applyBpmnEventDefinitionRefControl,
  createBpmnEventDefinitionRefControls,
  ensureBpmnGlobalDefinitionPatchForTrigger,
  updateBpmnEventDefinitionDraft,
} from '@/elements/bpmn/definitions/bpmn-event-definition-refs'

export const BpmnEventVariantProvider: ModelerElementVariantProvider<BpmnEventElement> = {
  id: 'bpmn.event.variants',
  matches: (_context, element): element is BpmnEventElement => element.type === BPMN_EVENT_TYPE,
  createDraft: (_context, element) => ({
    eventPosition: element.data?.eventPosition,
    trigger: element.data?.trigger,
    direction: element.data?.direction,
    messageRef: element.data?.messageRef,
    signalRef: element.data?.signalRef,
    errorRef: element.data?.errorRef,
    escalationRef: element.data?.escalationRef,
  }),
  getDescriptor: (context, element, draft) => {
    const data = element.data ?? { eventPosition: 'start' as const, trigger: 'none' as const }
    const normalized = normalizeBpmnEventVariantData(
      draft.eventPosition ?? data.eventPosition,
      draft.trigger ?? data.trigger,
      draft.direction ?? data.direction,
    )
    const eventPosition = normalized.eventPosition
    const trigger = normalized.trigger
    const direction = normalized.direction
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
            data: normalizeBpmnEventVariantData(position.id, trigger, direction),
          })),
        },
        {
          id: 'trigger',
          kind: 'list',
          title: 'Event definition',
          value: `${eventPosition}:${trigger}:${direction}`,
          options: createBpmnEventVariantOptions(eventPosition, element, draft),
        },
        ...createBpmnEventDefinitionRefControls(context, element, trigger, draft),
      ],
    }
  },
  updateDraft: (_context, element, draft, _control, option) => {
    return {
      ...draft,
      ...resolveBpmnEventVariantData(option.data, draft, element),
      ...updateBpmnEventDefinitionDraft(element, draft, option),
    }
  },
  apply: ({ context, element, draft, control, option }) => {
    const data = resolveBpmnEventVariantData(option.data, draft, element)
    const definitionOnlyPatch = applyBpmnEventDefinitionRefControl({ context, element, trigger: data.trigger, draft, control, option })
    if (definitionOnlyPatch) {
      context.applyCommand({
        type: 'element.patch',
        id: element.id,
        patch: { data: definitionOnlyPatch },
      })
      return
    }
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          eventPosition: data.eventPosition,
          trigger: data.trigger,
          direction: data.direction,
          ...ensureBpmnGlobalDefinitionPatchForTrigger(context, element, data.trigger, draft),
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
  const current = normalizeBpmnEventVariantData(
    draft.eventPosition ?? element?.data?.eventPosition,
    draft.trigger ?? element?.data?.trigger,
    draft.direction ?? element?.data?.direction,
  )

  return options.map(option => ({
    id: option.id,
    title: option.title,
    icon: resolveBpmnEventTriggerIcon(option.trigger),
    selected:
      current.eventPosition === option.eventPosition &&
      current.trigger === option.trigger &&
      current.direction === option.direction,
    data: {
      eventPosition: option.eventPosition,
      trigger: option.trigger,
      direction: option.direction,
    },
  }))
}

export function resolveBpmnEventVariantData(
  data: unknown,
  draft: ModelerElementVariantDraft = {},
  element?: BpmnEventElement,
): BpmnEventVariantData {
  const maybeData = typeof data === 'object' && data !== null ? data as Partial<BpmnEventVariantData> : {}
  const eventPosition = normalizeBpmnEventPosition(
    maybeData.eventPosition,
    normalizeBpmnEventPosition(draft.eventPosition ?? element?.data?.eventPosition),
  )
  const trigger = normalizeBpmnEventTrigger(
    maybeData.trigger,
    normalizeBpmnEventTrigger(draft.trigger ?? element?.data?.trigger),
  )
  const direction = normalizeBpmnEventDirection(
    maybeData.direction,
    normalizeBpmnEventDirection(draft.direction ?? element?.data?.direction, defaultBpmnEventDirection(eventPosition)),
  )
  return normalizeBpmnEventVariantData(eventPosition, trigger, direction)
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

export function resolveBpmnEventTriggers(eventPosition: BpmnEventPosition): Array<BpmnEventVariantData & { id: string; title: string }> {
  return resolveBpmnEventVariants(eventPosition)
}
