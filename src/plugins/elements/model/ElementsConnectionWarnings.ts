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
  private warning: ElementsConnectionWarning | null = null
  private readonly listeners = new Set<() => void>()

  get(): ElementsConnectionWarning | null {
    return this.warning ? { ...this.warning } : null
  }

  show(input: Omit<ElementsConnectionWarning, 'id'> & { id?: string }): void {
    this.warning = {
      id: input.id ?? `connection-warning-${Date.now().toString(36)}`,
      title: input.title,
      message: input.message,
      duplicateElementId: input.duplicateElementId,
    }
    this.notify()
  }

  clear(): void {
    if (!this.warning) return
    this.warning = null
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
