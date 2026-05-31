import type {
  ModelerElement,
  ModelerPluginContext,
  ModelerPoint,
  ModelerToolDefinition,
} from '@/domain/types/index'

export class ToolRegistry {
  private readonly items = new Map<string, ModelerToolDefinition>()
  private readonly listeners = new Set<(activeToolId: string | null) => void>()
  private activeId: string | null = null

  constructor(
    private readonly getContext: () => ModelerPluginContext,
    private readonly invalidate: () => void,
  ) {}

  register(definition: ModelerToolDefinition): () => void {
    this.items.set(definition.id, definition)
    return () => {
      if (this.items.get(definition.id) !== definition) return
      if (this.activeId === definition.id) this.deactivate(definition.id)
      this.items.delete(definition.id)
    }
  }

  get(id: string): ModelerToolDefinition | undefined {
    return this.items.get(id)
  }

  getAll(): ReadonlyArray<ModelerToolDefinition> {
    return [...this.items.values()]
  }

  activate(id: string): boolean {
    const next = this.items.get(id)
    if (!next) return false
    if (this.activeId === id) return true
    const current = this.getActive()
    if (current) current.deactivate?.(this.getContext())
    this.activeId = id
    next.activate?.(this.getContext())
    this.invalidate()
    this.notify()
    return true
  }

  deactivate(id?: string): boolean {
    if (!this.activeId) return false
    if (id && this.activeId !== id) return false
    const current = this.getActive()
    this.activeId = null
    current?.deactivate?.(this.getContext())
    this.invalidate()
    this.notify()
    return true
  }

  getActive(): ModelerToolDefinition | undefined {
    return this.activeId ? this.items.get(this.activeId) : undefined
  }

  getActiveId(): string | null {
    return this.activeId
  }

  createAt(id: string, point: ModelerPoint): ModelerElement | undefined {
    const tool = this.items.get(id)
    if (!tool?.createAt) return undefined
    const element = tool.createAt(this.getContext(), point)
    if (tool.oneShot !== false) this.deactivate(id)
    return element
  }

  subscribe(listener: (activeToolId: string | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.activeId))
  }
}
