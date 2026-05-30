import type { NovaSchema } from '@endge/nova'
import type { ModelerRect } from '@/domain/types/index'

export function createMarqueeSchema(rect: ModelerRect): NovaSchema[number] {
  return {
    type: 'rect',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    styles: {
      background: 'rgba(37, 99, 235, 0.10)',
      border: { color: '#2563eb', width: 1 },
    },
  }
}
