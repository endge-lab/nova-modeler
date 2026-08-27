import type {
  ModelerElement,
  ModelerPluginContext,
  ModelerPoint,
  ModelerToolDefinition,
} from '@/domain/types/index'

export class ToolRegistry {
  private readonly _items = new Map<string, ModelerToolDefinition>()
  private readonly _listeners = new Set<(activeToolId: string | null) => void>()
  private _activeId: string | null = null

  constructor(
    private readonly _getContext: () => ModelerPluginContext,
    private readonly _invalidate: () => void,
  ) {}

  register(definition: ModelerToolDefinition): () => void {
    this._items.set(definition.id, definition)
    return () => {
      if (this._items.get(definition.id) !== definition) {
        return
      }
      if (this._activeId === definition.id) {
        this.deactivate(definition.id)
      }
      this._items.delete(definition.id)
    }
  }

  get(id: string): ModelerToolDefinition | undefined {
    return this._items.get(id)
  }

  getAll(): ReadonlyArray<ModelerToolDefinition> {
    return [...this._items.values()]
  }

  activate(id: string): boolean {
    const next = this._items.get(id)
    if (!next) {
      return false
    }
    if (this._activeId === id) {
      return true
    }
    const current = this.getActive()
    if (current) {
      current.deactivate?.(this._getContext())
    }
    this._activeId = id
    next.activate?.(this._getContext())
    this._invalidate()
    this._notify()
    return true
  }

  deactivate(id?: string): boolean {
    if (!this._activeId) {
      return false
    }
    if (id && this._activeId !== id) {
      return false
    }
    const current = this.getActive()
    this._activeId = null
    current?.deactivate?.(this._getContext())
    this._invalidate()
    this._notify()
    return true
  }

  getActive(): ModelerToolDefinition | undefined {
    return this._activeId ? this._items.get(this._activeId) : undefined
  }

  getActiveId(): string | null {
    return this._activeId
  }

  createAt(id: string, point: ModelerPoint): ModelerElement | undefined {
    const tool = this._items.get(id)
    if (!tool?.createAt) {
      return undefined
    }
    const element = tool.createAt(this._getContext(), point)
    if (tool.oneShot !== false) {
      this.deactivate(id)
    }
    return element
  }

  subscribe(listener: (activeToolId: string | null) => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _notify(): void {
    this._listeners.forEach(listener => listener(this._activeId))
  }
}
