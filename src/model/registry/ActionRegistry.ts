import type {
  ModelerActionDefinition,
  ModelerPluginContext,
} from '@/domain/types'

export class ActionRegistry {
  private readonly _items = new Map<string, ModelerActionDefinition>()

  constructor(private readonly _getContext: () => ModelerPluginContext) {}

  register(definition: ModelerActionDefinition): () => void {
    this._items.set(definition.id, definition)
    return () => {
      if (this._items.get(definition.id) === definition) {
        this._items.delete(definition.id)
      }
    }
  }

  get(id: string): ModelerActionDefinition | undefined {
    return this._items.get(id)
  }

  getAll(): ReadonlyArray<ModelerActionDefinition> {
    return [...this._items.values()]
  }

  run(id: string): boolean {
    const definition = this._items.get(id)
    if (!definition) {
      return false
    }
    definition.run(this._getContext())
    return true
  }
}
