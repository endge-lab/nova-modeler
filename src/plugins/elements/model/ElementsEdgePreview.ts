import type { ModelerEdgeElement } from '@/domain/types/index'

export class ElementsEdgePreview {
  private element: ModelerEdgeElement | null = null
  private readonly listeners = new Set<() => void>()

  set(element: ModelerEdgeElement): void {
    this.element = cloneEdgeElement(element)
    this.notify()
  }

  get(): ModelerEdgeElement | null {
    return this.element ? cloneEdgeElement(this.element) : null
  }

  clear(): void {
    if (!this.element) return
    this.element = null
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}

function cloneEdgeElement(element: ModelerEdgeElement): ModelerEdgeElement {
  return {
    ...element,
    source: {
      ...element.source,
      point: element.source.point ? { ...element.source.point } : undefined,
    },
    target: {
      ...element.target,
      point: element.target.point ? { ...element.target.point } : undefined,
    },
    waypoints: element.waypoints.map(point => ({ ...point })),
    data: { ...element.data },
    style: { ...element.style },
  }
}
