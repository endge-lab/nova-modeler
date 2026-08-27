import type {
  ModelerKeyboardShortcut,
  ModelerResolvedShortcut,
  ModelerSelectionOptions,
  ModelerShortcutDefinition,
  ModelerShortcutOptions,
} from '@/domain/types/index'
import { SelectionRuntime } from '@/model/selection/SelectionRuntime'

export class ShortcutRegistry {
  private readonly _items = new Map<string, ModelerShortcutDefinition>()

  constructor(
    private readonly _getOptions: () => ModelerShortcutOptions | undefined,
    private readonly _getSelectionOptions: () => ModelerSelectionOptions | undefined,
  ) {}

  register(definition: ModelerShortcutDefinition): () => void {
    this._items.set(definition.id, definition)
    return () => {
      if (this._items.get(definition.id) === definition) {
        this._items.delete(definition.id)
      }
    }
  }

  get(id: string): ModelerShortcutDefinition | undefined {
    return this._items.get(id)
  }

  getAll(): ReadonlyArray<ModelerShortcutDefinition> {
    return [...this._items.values()]
  }

  resolve(event: KeyboardEvent): ModelerResolvedShortcut | undefined {
    for (const definition of this._items.values()) {
      const shortcut = SelectionRuntime.matchShortcut(event, this._resolveBindings(definition))
      if (shortcut) {
        return { definition, shortcut }
      }
    }
    return undefined
  }

  private _resolveBindings(definition: ModelerShortcutDefinition): Array<ModelerKeyboardShortcut> {
    const bindings = this._getOptions()?.bindings
    if (bindings && Object.hasOwn(bindings, definition.id)) {
      return bindings[definition.id] ?? []
    }
    if (definition.id === 'selection.delete') {
      return this._getSelectionOptions()?.deleteShortcuts ?? definition.defaults ?? []
    }
    return definition.defaults ?? []
  }
}
