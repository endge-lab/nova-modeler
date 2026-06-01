import type { ModelerPoint } from '@/domain/types/index'

export class ElementsContextPadAnchors {
  private readonly anchors = new Map<string, ModelerPoint>()

  set(elementId: string, point: ModelerPoint): void {
    this.anchors.set(elementId, { x: point.x, y: point.y })
  }

  get(elementId: string): ModelerPoint | undefined {
    const point = this.anchors.get(elementId)
    return point ? { x: point.x, y: point.y } : undefined
  }

  clear(elementId?: string): void {
    if (elementId) {
      this.anchors.delete(elementId)
      return
    }
    this.anchors.clear()
  }
}
