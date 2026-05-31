import type { ModelerElementDefinition } from '@/domain/types/elements/element-definition.types'

export interface ModelerElementRegistry {
  register(definition: ModelerElementDefinition): this
  registerMany(definitions: Array<ModelerElementDefinition>): this
  get(type: string): ModelerElementDefinition | undefined
  require(type: string): ModelerElementDefinition
  getAll(): ReadonlyArray<ModelerElementDefinition>
}
