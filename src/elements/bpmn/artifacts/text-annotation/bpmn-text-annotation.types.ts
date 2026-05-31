import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export type BpmnTextAnnotationBracketSide = 'left' | 'right'

export interface BpmnTextAnnotationElementData extends Record<string, unknown> {
  text: string
  bracketSide: BpmnTextAnnotationBracketSide
}

export type BpmnTextAnnotationElement = ModelerElement<BpmnTextAnnotationElementData>

export type BpmnTextAnnotationElementInput =
  ModelerElementInput<Partial<BpmnTextAnnotationElementData>> & {
    text?: string
    bracketSide?: BpmnTextAnnotationBracketSide
  }
