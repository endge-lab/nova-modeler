import type {
  ModelerPaletteItemDefinition,
  ModelerPaletteOptions,
} from '@/domain/types/index'

export class PaletteRegistry {
  private readonly _items = new Map<string, ModelerPaletteItemDefinition>()

  constructor(private readonly _getOptions: () => ModelerPaletteOptions | undefined) {}

  register(definition: ModelerPaletteItemDefinition): () => void {
    this._items.set(definition.id, definition)
    return () => {
      if (this._items.get(definition.id) === definition) {
        this._items.delete(definition.id)
      }
    }
  }

  get(id: string): ModelerPaletteItemDefinition | undefined {
    return this._items.get(id)
  }

  getAll(): ReadonlyArray<ModelerPaletteItemDefinition> {
    return [...this._items.values()]
  }

  getItems(): Array<ModelerPaletteItemDefinition> {
    const options = this._getOptions()
    const visible = options?.visibleItemIds ? new Set(options.visibleItemIds) : null
    const order = new Map((options?.order ?? []).map((id, index) => [id, index]))
    return [...this._items.values()]
      .filter(item => !visible || visible.has(item.id))
      .sort((a, b) => {
        const orderA = order.has(a.id) ? order.get(a.id) ?? 0 : Number.POSITIVE_INFINITY
        const orderB = order.has(b.id) ? order.get(b.id) ?? 0 : Number.POSITIVE_INFINITY
        if (orderA !== orderB) {
          return orderA - orderB
        }
        if (a.group !== b.group) {
          return resolveGroupOrder(a.group) - resolveGroupOrder(b.group)
        }
        return (a.order ?? 0) - (b.order ?? 0)
      })
  }
}

function resolveGroupOrder(group: string): number {
  if (group === 'tools') {
    return 0
  }
  if (group === 'elements') {
    return 100
  }
  return 50
}
