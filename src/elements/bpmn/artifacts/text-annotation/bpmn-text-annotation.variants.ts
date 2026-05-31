import type {
  ModelerElementVariantProvider,
} from '@/domain/types'
import {
  BPMN_TEXT_ANNOTATION_TYPE,
  normalizeBpmnTextAnnotationBracketSide,
} from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.factory'
import type {
  BpmnTextAnnotationBracketSide,
  BpmnTextAnnotationElement,
} from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.types'

const BRACKET_SIDES: Array<{ id: BpmnTextAnnotationBracketSide; title: string }> = [
  { id: 'left', title: 'Left bracket' },
  { id: 'right', title: 'Right bracket' },
]

export const BpmnTextAnnotationVariantProvider: ModelerElementVariantProvider<BpmnTextAnnotationElement> = {
  id: 'bpmn.textAnnotation.variants',
  matches: (_context, element): element is BpmnTextAnnotationElement => element.type === BPMN_TEXT_ANNOTATION_TYPE,
  createDraft: (_context, element) => ({
    bracketSide: element.data?.bracketSide,
  }),
  getDescriptor: (_context, element, draft) => {
    const value = normalizeBpmnTextAnnotationBracketSide(draft.bracketSide ?? element.data?.bracketSide)
    return {
      title: 'Change annotation',
      controls: [{
        id: 'bracketSide',
        kind: 'choice',
        title: 'Bracket side',
        value,
        options: BRACKET_SIDES.map(side => ({
          id: side.id,
          title: side.title,
          selected: side.id === value,
          data: { bracketSide: side.id },
        })),
      }],
    }
  },
  apply: ({ context, element, option }) => {
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          bracketSide: normalizeBpmnTextAnnotationBracketSide(option.data?.bracketSide ?? option.id),
        },
      },
    })
  },
}
