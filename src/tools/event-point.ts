import type { ModelerPoint } from '@/domain/types/index'

export function eventPoint(event: MouseEvent): ModelerPoint {
  const offsetX = Number(event.offsetX)
  const offsetY = Number(event.offsetY)
  const clientX = Number(event.clientX)
  const clientY = Number(event.clientY)
  return {
    x: Number.isFinite(offsetX) && (offsetX !== 0 || !Number.isFinite(clientX) || clientX === 0) ? offsetX : clientX,
    y: Number.isFinite(offsetY) && (offsetY !== 0 || !Number.isFinite(clientY) || clientY === 0) ? offsetY : clientY,
  }
}
