import type {
  BpmnGroupElement,
  BpmnGroupElementInput,
} from '@/elements/bpmn/artifacts/group/bpmn-group.types'

export const BPMN_GROUP_TYPE = 'bpmn.group'
export const BPMN_GROUP_DEFAULT_WIDTH = 240
export const BPMN_GROUP_DEFAULT_HEIGHT = 160
export const BPMN_GROUP_MIN_WIDTH = 120
export const BPMN_GROUP_MIN_HEIGHT = 80

export function createBpmnGroupElement(input: BpmnGroupElementInput): BpmnGroupElement {
  const data = input.data ?? {}
  return {
    id: input.id,
    type: BPMN_GROUP_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: finiteNumber(input.width, BPMN_GROUP_DEFAULT_WIDTH),
    height: finiteNumber(input.height, BPMN_GROUP_DEFAULT_HEIGHT),
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      name: normalizeName(input.name ?? data.name),
    },
    style: { ...input.style },
  }
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Group'
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
