import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerPoint } from '@/domain/types/model/geometry.types'
import type { ModelerPluginContext } from '@/domain/types/plugins/plugin.types'

export type ModelerToolKind = 'mode' | 'create-element'

export interface ModelerToolDefinition {
  id: string
  kind: ModelerToolKind
  title?: string
  activate?(context: ModelerPluginContext): void
  deactivate?(context: ModelerPluginContext): void
  createAt?(context: ModelerPluginContext, point: ModelerPoint): ModelerElement | undefined
  oneShot?: boolean
}

export interface ModelerToolRegistryApi {
  register(definition: ModelerToolDefinition): () => void
  get(id: string): ModelerToolDefinition | undefined
  getAll(): ReadonlyArray<ModelerToolDefinition>
  activate(id: string): boolean
  deactivate(id?: string): boolean
  getActive(): ModelerToolDefinition | undefined
  getActiveId(): string | null
  createAt(id: string, point: ModelerPoint): ModelerElement | undefined
  subscribe(listener: (activeToolId: string | null) => void): () => void
}
