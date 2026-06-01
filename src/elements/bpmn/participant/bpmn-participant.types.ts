import type {
  ModelerElement,
  ModelerElementInput,
  ModelerRect,
} from '@/domain/types/index'

export type BpmnParticipantOrientation = 'horizontal' | 'vertical'

export interface BpmnParticipantLane {
  id: string
  name: string
  size: number
}

export interface BpmnParticipantElementData extends Record<string, unknown> {
  name: string
  orientation: BpmnParticipantOrientation
  lanes: Array<BpmnParticipantLane>
}

export interface BpmnParticipantLayoutLane extends BpmnParticipantLane {
  rect: ModelerRect
  headerRect: ModelerRect
  contentRect: ModelerRect
}

export interface BpmnParticipantLayout {
  bounds: ModelerRect
  participantHeaderRect: ModelerRect
  laneHeaderAreaRect: ModelerRect
  contentRect: ModelerRect
  lanes: Array<BpmnParticipantLayoutLane>
}

export type BpmnParticipantElement = ModelerElement<BpmnParticipantElementData>

export type BpmnParticipantElementInput =
  ModelerElementInput<Partial<BpmnParticipantElementData>> & {
    name?: string
    orientation?: BpmnParticipantOrientation
    lanes?: Array<Partial<BpmnParticipantLane>>
  }
