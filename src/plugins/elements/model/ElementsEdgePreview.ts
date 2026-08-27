import type { ModelerEdgeElement } from '@/domain/types/index'

export class ElementsEdgePreview {
  private _element: ModelerEdgeElement | null = null
  private readonly _listeners = new Set<() => void>()

  set(element: ModelerEdgeElement): void {
    this._element = cloneEdgeElement(element)
    this._notify()
  }

  get(): ModelerEdgeElement | null {
    return this._element ? cloneEdgeElement(this._element) : null
  }

  clear(): void {
    if (!this._element) {
      return
    }
    this._element = null
    this._notify()
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
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
