import type {
  BpmnTextAnnotationBracketSide,
  BpmnTextAnnotationElement,
  BpmnTextAnnotationElementInput,
} from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.types'

export const BPMN_TEXT_ANNOTATION_TYPE = 'bpmn.textAnnotation'
export const BPMN_TEXT_ANNOTATION_DEFAULT_WIDTH = 160
export const BPMN_TEXT_ANNOTATION_DEFAULT_HEIGHT = 80
export const BPMN_TEXT_ANNOTATION_MIN_WIDTH = 96
export const BPMN_TEXT_ANNOTATION_MIN_HEIGHT = 48

export function createBpmnTextAnnotationElement(input: BpmnTextAnnotationElementInput): BpmnTextAnnotationElement {
  const data = input.data ?? {}
  return {
    id: input.id,
    type: BPMN_TEXT_ANNOTATION_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: finiteNumber(input.width, BPMN_TEXT_ANNOTATION_DEFAULT_WIDTH),
    height: finiteNumber(input.height, BPMN_TEXT_ANNOTATION_DEFAULT_HEIGHT),
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      text: normalizeText(input.text ?? data.text),
      bracketSide: normalizeBracketSide(input.bracketSide ?? data.bracketSide),
    },
    style: { ...input.style },
  }
}

export function normalizeBpmnTextAnnotationBracketSide(value: unknown): BpmnTextAnnotationBracketSide {
  return normalizeBracketSide(value)
}

function normalizeBracketSide(value: unknown): BpmnTextAnnotationBracketSide {
  return value === 'right' ? 'right' : 'left'
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Text annotation'
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
