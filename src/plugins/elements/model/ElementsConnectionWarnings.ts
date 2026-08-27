export interface ElementsConnectionWarning {
  id: string
  title: string
  message: string
  duplicateElementId?: string
}

/**
 * Хранит короткие предупреждения connection runtime, которые должны быть показаны поверх canvas.
 */
export class ElementsConnectionWarnings {
  private _warning: ElementsConnectionWarning | null = null
  private readonly _listeners = new Set<() => void>()

  get(): ElementsConnectionWarning | null {
    return this._warning ? { ...this._warning } : null
  }

  show(input: Omit<ElementsConnectionWarning, 'id'> & { id?: string }): void {
    this._warning = {
      id: input.id ?? `connection-warning-${Date.now().toString(36)}`,
      title: input.title,
      message: input.message,
      duplicateElementId: input.duplicateElementId,
    }
    this._notify()
  }

  clear(): void {
    if (!this._warning) {
      return
    }
    this._warning = null
    this._notify()
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => {
      this._listeners.delete(listener)
    }
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }
}
