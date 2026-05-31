import type {
  ModelerActionDefinition,
  ModelerPluginContext,
} from '@/domain/types'

export class ActionRegistry {
  private readonly items = new Map<string, ModelerActionDefinition>()

  constructor(private readonly getContext: () => ModelerPluginContext) {}

  register(definition: ModelerActionDefinition): () => void {
    this.items.set(definition.id, definition)
    return () => {
      if (this.items.get(definition.id) === definition) this.items.delete(definition.id)
    }
  }

  get(id: string): ModelerActionDefinition | undefined {
    return this.items.get(id)
  }

  getAll(): ReadonlyArray<ModelerActionDefinition> {
    return [...this.items.values()]
  }

  run(id: string): boolean {
    const definition = this.items.get(id)
    if (!definition) return false
    definition.run(this.getContext())
    return true
  }
}
