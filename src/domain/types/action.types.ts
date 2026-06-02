import type { ModelerPluginContext } from '@/domain/types/plugins/plugin.types'

export interface ModelerActionDefinition {
  id: string
  title?: string
  run(context: ModelerPluginContext): void
}

export interface ModelerActionRegistryApi {
  register(definition: ModelerActionDefinition): () => void
  get(id: string): ModelerActionDefinition | undefined
  getAll(): ReadonlyArray<ModelerActionDefinition>
  run(id: string): boolean
}
