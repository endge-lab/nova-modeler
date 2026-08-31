import type { AnyModelerElementDefinition } from '@/domain/types/elements/element-definition.types'

export interface ModelerElementRegistry {
  register: (definition: AnyModelerElementDefinition) => this
  registerMany: (definitions: Array<AnyModelerElementDefinition>) => this
  get: (type: string) => AnyModelerElementDefinition | undefined
  require: (type: string) => AnyModelerElementDefinition
  getAll: () => ReadonlyArray<AnyModelerElementDefinition>
}
