import type { ModelerPoint } from '@/domain/types/index'

export function eventPoint(event: MouseEvent): ModelerPoint {
  return {
    x: event.offsetX,
    y: event.offsetY,
  }
}
