import type {
  BpmnDataStoreElement,
  BpmnDataStoreElementInput,
} from '@/elements/bpmn/data/data-store/bpmn-data-store.types'

export const BPMN_DATA_STORE_TYPE = 'bpmn.dataStore'
export const BPMN_DATA_STORE_DEFAULT_WIDTH = 120
export const BPMN_DATA_STORE_DEFAULT_HEIGHT = 96
export const BPMN_DATA_STORE_MIN_WIDTH = 80
export const BPMN_DATA_STORE_MIN_HEIGHT = 56

export function createBpmnDataStoreElement(input: BpmnDataStoreElementInput): BpmnDataStoreElement {
  const data = input.data ?? {}
  return {
    id: input.id,
    type: BPMN_DATA_STORE_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: finiteNumber(input.width, BPMN_DATA_STORE_DEFAULT_WIDTH),
    height: finiteNumber(input.height, BPMN_DATA_STORE_DEFAULT_HEIGHT),
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
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Data store'
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
