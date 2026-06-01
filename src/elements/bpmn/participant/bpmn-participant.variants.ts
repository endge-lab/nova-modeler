import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  ModelerElementVariantDescriptor,
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_PARTICIPANT_TYPE,
  createBpmnParticipantElement,
  normalizeBpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type {
  BpmnParticipantElement,
  BpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.types'

const ORIENTATIONS: Array<{ id: BpmnParticipantOrientation; title: string }> = [
  { id: 'horizontal', title: 'Horizontal' },
  { id: 'vertical', title: 'Vertical' },
]

export const BpmnParticipantVariantProvider: ModelerElementVariantProvider<BpmnParticipantElement> = {
  id: 'bpmn.swimlane.variants',
  matches: (_context, element): element is BpmnParticipantElement => element.type === BPMN_PARTICIPANT_TYPE,
  createDraft: (_context, element) => ({
    orientation: normalizeBpmnParticipantOrientation(element.data?.orientation),
  }),
  getDescriptor: (_context, element, draft): ModelerElementVariantDescriptor => {
    const orientation = normalizeBpmnParticipantOrientation(draft.orientation ?? element.data?.orientation)
    return {
      title: 'Change swimlane',
      controls: [{
        id: 'orientation',
        kind: 'choice',
        title: 'Orientation',
        value: orientation,
        options: ORIENTATIONS.map(option => ({
          id: option.id,
          title: option.title,
          icon: option.id === 'vertical'
            ? MODELER_ASSETS.icons.swimlaneVertical
            : MODELER_ASSETS.icons.swimlaneHorizontal,
          selected: orientation === option.id,
          data: { orientation: option.id },
        })),
      }],
    }
  },
  updateDraft: (_context, element, draft, _control, option) => ({
    orientation: normalizeBpmnParticipantOrientation(option.data?.orientation ?? draft.orientation ?? element.data?.orientation),
  }),
  apply: ({ context, element, draft, option }) => {
    const orientation = normalizeBpmnParticipantOrientation(option.data?.orientation ?? draft.orientation ?? element.data?.orientation)
    context.applyCommand({
      type: 'element.replace',
      id: element.id,
      element: createBpmnParticipantElement({
        ...element,
        orientation,
      }),
    })
  },
}
