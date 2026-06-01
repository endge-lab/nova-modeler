import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_BOUNDARY_EVENT_TRIGGERS,
  BPMN_BOUNDARY_EVENT_TYPE,
  normalizeBpmnBoundaryEventTrigger,
} from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import type {
  BpmnBoundaryEventElement,
} from '@/elements/bpmn/boundary-event/bpmn-boundary-event.types'
import { resolveBpmnEventTriggerIcon } from '@/elements/bpmn/event/bpmn-event.variants'

export const BpmnBoundaryEventVariantProvider: ModelerElementVariantProvider<BpmnBoundaryEventElement> = {
  id: 'bpmn.boundaryEvent.variants',
  matches: (_context, element): element is BpmnBoundaryEventElement => element.type === BPMN_BOUNDARY_EVENT_TYPE,
  createDraft: (_context, element) => ({
    trigger: element.data?.trigger,
    isInterrupting: element.data?.isInterrupting,
  }),
  getDescriptor: (_context, element, draft) => {
    const trigger = normalizeBpmnBoundaryEventTrigger(draft.trigger ?? element.data?.trigger)
    const isInterrupting = (draft.isInterrupting ?? element.data?.isInterrupting) !== false
    return {
      title: 'Change boundary event',
      headerControls: [{
        id: 'isInterrupting',
        kind: 'iconToggle',
        value: isInterrupting,
        options: [{
          id: 'interrupting',
          title: 'Interrupting',
          icon: MODELER_ASSETS.icons.event,
          selected: isInterrupting,
          data: { isInterrupting: !isInterrupting },
        }],
      }],
      controls: [{
        id: 'trigger',
        kind: 'list',
        title: 'Event definition',
        value: trigger,
        options: BPMN_BOUNDARY_EVENT_TRIGGERS.map(option => ({
          id: option.id,
          title: option.title,
          icon: resolveBpmnEventTriggerIcon(option.id),
          selected: trigger === option.id,
          data: { trigger: option.id },
        })),
      }],
    }
  },
  updateDraft: (_context, element, draft, _control, option) => ({
    ...draft,
    trigger: normalizeBpmnBoundaryEventTrigger(option.data?.trigger ?? draft.trigger ?? element.data?.trigger),
    isInterrupting: option.data?.isInterrupting ?? draft.isInterrupting ?? element.data?.isInterrupting,
  }),
  apply: ({ context, element, draft, option }) => {
    const trigger = normalizeBpmnBoundaryEventTrigger(option.data?.trigger ?? draft.trigger ?? element.data?.trigger)
    const isInterrupting = (option.data?.isInterrupting ?? draft.isInterrupting ?? element.data?.isInterrupting) !== false
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          eventPosition: 'intermediate',
          trigger,
          direction: 'catch',
          isInterrupting,
        },
      },
    })
  },
}
