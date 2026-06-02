import type { ModelerExternalLabelGeometry } from '@/domain/types/index'

export function normalizeExternalLabelGeometry(value: unknown): ModelerExternalLabelGeometry | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Partial<ModelerExternalLabelGeometry>
  if (!isFiniteNumber(input.offsetX) || !isFiniteNumber(input.offsetY) || !isFiniteNumber(input.width) || !isFiniteNumber(input.height)) {
    return undefined
  }
  return {
    offsetX: input.offsetX,
    offsetY: input.offsetY,
    width: Math.max(1, input.width),
    height: Math.max(1, input.height),
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
