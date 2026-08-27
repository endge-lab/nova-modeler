import type { ModelerPoint } from '@/domain/types/index'

export class ElementsContextPadAnchors {
  private readonly _anchors = new Map<string, ModelerPoint>()
  private readonly _parts = new Map<string, { partType: string, partId: string }>()

  set(elementId: string, point: ModelerPoint, part?: { partType: string, partId: string }): void {
    this._anchors.set(elementId, { x: point.x, y: point.y })
    if (part) {
      this._parts.set(elementId, { ...part })
    }
    else { this._parts.delete(elementId) }
  }

  get(elementId: string): ModelerPoint | undefined {
    const point = this._anchors.get(elementId)
    return point ? { x: point.x, y: point.y } : undefined
  }

  getPart(elementId: string): { partType: string, partId: string } | undefined {
    const part = this._parts.get(elementId)
    return part ? { ...part } : undefined
  }

  clear(elementId?: string): void {
    if (elementId) {
      this._anchors.delete(elementId)
      this._parts.delete(elementId)
      return
    }
    this._anchors.clear()
    this._parts.clear()
  }
}
