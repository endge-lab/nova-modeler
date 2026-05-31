import type { TooltipInput } from '@endge/nova-ui-kit'

export type ModelerPaletteItemKind = 'action' | 'tool'

export interface ModelerPaletteItemDefinition {
  id: string
  kind: ModelerPaletteItemKind
  group: string
  order?: number
  title?: string
  icon?: string
  tooltip?: TooltipInput
  actionId?: string
  toolId?: string
}

export interface ModelerPaletteGroupOptions {
  dividerAfter?: boolean
}

export type ModelerPalettePlacement = 'left' | 'right' | 'top' | 'bottom'

export interface ModelerPaletteOptions {
  placement?: ModelerPalettePlacement
  draggable?: boolean
  offset?: number
  offsetX?: number
  offsetY?: number
  itemSize?: number
  gap?: number
  padding?: number
  gripSize?: number
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
