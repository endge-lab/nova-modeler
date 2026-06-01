import type { ModelerPoint } from '@/domain/types/index'

export class ElementsContextPadAnchors {
  private readonly anchors = new Map<string, ModelerPoint>()
  private readonly parts = new Map<string, { partType: string; partId: string }>()

  set(elementId: string, point: ModelerPoint, part?: { partType: string; partId: string }): void {
    this.anchors.set(elementId, { x: point.x, y: point.y })
    if (part) this.parts.set(elementId, { ...part })
    else this.parts.delete(elementId)
  }

  get(elementId: string): ModelerPoint | undefined {
    const point = this.anchors.get(elementId)
    return point ? { x: point.x, y: point.y } : undefined
  }

  getPart(elementId: string): { partType: string; partId: string } | undefined {
    const part = this.parts.get(elementId)
    return part ? { ...part } : undefined
  }

  clear(elementId?: string): void {
    if (elementId) {
      this.anchors.delete(elementId)
      this.parts.delete(elementId)
      return
    }
    this.anchors.clear()
    this.parts.clear()
  }
}
