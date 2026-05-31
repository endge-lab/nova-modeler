export type ModelerPaletteItemKind = 'action' | 'tool'

export interface ModelerPaletteItemDefinition {
  id: string
  kind: ModelerPaletteItemKind
  group: string
  order?: number
  title?: string
  icon?: string
  actionId?: string
  toolId?: string
}

export interface ModelerPaletteGroupOptions {
  dividerAfter?: boolean
}

export interface ModelerPaletteOptions {
  visibleItemIds?: Array<string>
  order?: Array<string>
  groups?: Record<string, ModelerPaletteGroupOptions>
}

export interface ModelerPaletteRegistryApi {
  register(definition: ModelerPaletteItemDefinition): () => void
  get(id: string): ModelerPaletteItemDefinition | undefined
  getAll(): ReadonlyArray<ModelerPaletteItemDefinition>
  getItems(): Array<ModelerPaletteItemDefinition>
}
