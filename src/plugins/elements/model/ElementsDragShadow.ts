import type { ModelerElement } from '@/domain/types/index'

export class ElementsDragShadow {
  private elements: Array<ModelerElement> = []
  private readonly listeners = new Set<() => void>()

  begin(elements: Array<ModelerElement>): void {
    this.elements = elements.map(element => cloneElement(element))
    this.notify()
  }

  getElements(): Array<ModelerElement> {
    return this.elements.map(element => cloneElement(element))
  }

  clear(): void {
    if (this.elements.length === 0) return
    this.elements = []
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

function cloneElement(element: ModelerElement): ModelerElement {
  return {
    ...element,
    data: { ...element.data },
    style: { ...element.style },
  }
}
