import type {
  BpmnDataObjectElement,
  BpmnDataObjectElementInput,
  BpmnDataObjectType,
} from '@/elements/bpmn/data/data-object/bpmn-data-object.types'

export const BPMN_DATA_OBJECT_TYPE = 'bpmn.dataObject'
export const BPMN_DATA_OBJECT_DEFAULT_WIDTH = 96
export const BPMN_DATA_OBJECT_DEFAULT_HEIGHT = 120
export const BPMN_DATA_OBJECT_MIN_WIDTH = 64
export const BPMN_DATA_OBJECT_MIN_HEIGHT = 80

export function createBpmnDataObjectElement(input: BpmnDataObjectElementInput): BpmnDataObjectElement {
  const data = input.data ?? {}
  return {
    id: input.id,
    type: BPMN_DATA_OBJECT_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: finiteNumber(input.width, BPMN_DATA_OBJECT_DEFAULT_WIDTH),
    height: finiteNumber(input.height, BPMN_DATA_OBJECT_DEFAULT_HEIGHT),
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      name: normalizeName(input.name ?? data.name),
      dataObjectType: normalizeBpmnDataObjectType(input.dataObjectType ?? data.dataObjectType),
      isCollection: (input.isCollection ?? data.isCollection) === true,
    },
    style: { ...input.style },
  }
}

export function normalizeBpmnDataObjectType(value: unknown): BpmnDataObjectType {
  return value === 'input' || value === 'output' || value === 'object' ? value : 'object'
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Data object'
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
