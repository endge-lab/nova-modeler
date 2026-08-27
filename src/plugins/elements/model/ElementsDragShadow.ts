import type { ModelerElement } from '@/domain/types/index'

export class ElementsDragShadow {
  private _elements: Array<ModelerElement> = []
  private readonly _listeners = new Set<() => void>()

  begin(elements: Array<ModelerElement>): void {
    this._elements = elements.map(element => cloneElement(element))
    this._notify()
  }

  getElements(): Array<ModelerElement> {
    return this._elements.map(element => cloneElement(element))
  }

  clear(): void {
    if (this._elements.length === 0) {
      return
    }
    this._elements = []
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

function cloneElement(element: ModelerElement): ModelerElement {
  return {
    ...element,
    data: { ...element.data },
    style: { ...element.style },
  }
}
