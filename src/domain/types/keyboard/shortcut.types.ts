export type ModelerShortcutScope = 'canvas' | 'global'

export interface ModelerKeyboardShortcut {
  key?: string
  code?: string
  shift?: boolean
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  preventDefault?: boolean
}

export interface ModelerShortcutDefinition {
  id: string
  title?: string
  actionId?: string
  toolId?: string
  defaults?: Array<ModelerKeyboardShortcut>
  scope?: ModelerShortcutScope
}

export interface ModelerResolvedShortcut {
  definition: ModelerShortcutDefinition
  shortcut: ModelerKeyboardShortcut
}

export interface ModelerShortcutOptions {
  bindings?: Record<string, Array<ModelerKeyboardShortcut>>
}

export interface ModelerShortcutRegistryApi {
  register(definition: ModelerShortcutDefinition): () => void
  get(id: string): ModelerShortcutDefinition | undefined
  getAll(): ReadonlyArray<ModelerShortcutDefinition>
  resolve(event: KeyboardEvent): ModelerResolvedShortcut | undefined
}
