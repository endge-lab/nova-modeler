import type {
  ModelerKeyboardShortcut,
  ModelerResolvedShortcut,
  ModelerShortcutDefinition,
  ModelerShortcutOptions,
  ModelerSelectionOptions,
} from '@/domain/types/index'
import { SelectionRuntime } from '@/model/selection/SelectionRuntime'

export class ShortcutRegistry {
  private readonly items = new Map<string, ModelerShortcutDefinition>()

  constructor(
    private readonly getOptions: () => ModelerShortcutOptions | undefined,
    private readonly getSelectionOptions: () => ModelerSelectionOptions | undefined,
  ) {}

  register(definition: ModelerShortcutDefinition): () => void {
    this.items.set(definition.id, definition)
    return () => {
      if (this.items.get(definition.id) === definition) this.items.delete(definition.id)
    }
  }

  get(id: string): ModelerShortcutDefinition | undefined {
    return this.items.get(id)
  }

  getAll(): ReadonlyArray<ModelerShortcutDefinition> {
    return [...this.items.values()]
  }

  resolve(event: KeyboardEvent): ModelerResolvedShortcut | undefined {
    for (const definition of this.items.values()) {
      const shortcut = SelectionRuntime.matchShortcut(event, this.resolveBindings(definition))
      if (shortcut) return { definition, shortcut }
    }
    return undefined
  }

  private resolveBindings(definition: ModelerShortcutDefinition): Array<ModelerKeyboardShortcut> {
    const bindings = this.getOptions()?.bindings
    if (bindings && Object.prototype.hasOwnProperty.call(bindings, definition.id)) {
      return bindings[definition.id] ?? []
    }
    if (definition.id === 'selection.delete') {
      return this.getSelectionOptions()?.deleteShortcuts ?? definition.defaults ?? []
    }
    return definition.defaults ?? []
  }
}
