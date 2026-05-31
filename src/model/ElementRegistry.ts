import type {
  ModelerElementDefinition,
  ModelerElementRegistry,
} from '@/domain/types/index'
import { ModelerElementDefinitions } from '@/elements/elements'

/**
 * Хранит доступные definitions элементов Modeler.
 */
export class ElementRegistry implements ModelerElementRegistry {
  private readonly definitions = new Map<string, ModelerElementDefinition>()

  /**
   * Регистрирует definition элемента.
   */
  register(definition: ModelerElementDefinition): this {
    this.definitions.set(definition.type, definition)
    return this
  }

  /**
   * Регистрирует список definitions.
   */
  registerMany(definitions: Array<ModelerElementDefinition>): this {
    definitions.forEach(definition => this.register(definition))
    return this
  }

  /**
   * Возвращает definition элемента, если она зарегистрирована.
   */
  get(type: string): ModelerElementDefinition | undefined {
    return this.definitions.get(type)
  }

  /**
   * Возвращает definition элемента или выбрасывает ошибку.
   */
  require(type: string): ModelerElementDefinition {
    const definition = this.get(type)
    if (!definition) throw new Error(`[ElementRegistry] Element definition "${type}" is not registered.`)
    return definition
  }

  /**
   * Возвращает все зарегистрированные definitions.
   */
  getAll(): ReadonlyArray<ModelerElementDefinition> {
    return [...this.definitions.values()]
  }
}

/**
 * Создает registry с базовыми элементами Modeler.
 */
export function createModelerElementRegistry(
  definitions: Array<ModelerElementDefinition> = ModelerElementDefinitions,
): ElementRegistry {
  return new ElementRegistry().registerMany(definitions)
}
