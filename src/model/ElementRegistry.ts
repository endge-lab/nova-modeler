import type {
  AnyModelerElementDefinition,
  ModelerElementRegistry,
} from '@/domain/types/index'
import { ModelerElementDefinitions } from '@/elements/elements'

/**
 * Хранит доступные definitions элементов Modeler.
 */
export class ElementRegistry implements ModelerElementRegistry {
  private readonly _definitions = new Map<string, AnyModelerElementDefinition>()

  /**
   * Регистрирует definition элемента.
   */
  register(definition: AnyModelerElementDefinition): this {
    this._definitions.set(definition.type, definition)
    return this
  }

  /**
   * Регистрирует список definitions.
   */
  registerMany(definitions: Array<AnyModelerElementDefinition>): this {
    definitions.forEach(definition => this.register(definition))
    return this
  }

  /**
   * Возвращает definition элемента, если она зарегистрирована.
   */
  get(type: string): AnyModelerElementDefinition | undefined {
    return this._definitions.get(type)
  }

  /**
   * Возвращает definition элемента или выбрасывает ошибку.
   */
  require(type: string): AnyModelerElementDefinition {
    const definition = this.get(type)
    if (!definition) {
      throw new Error(`[ElementRegistry] Element definition "${type}" is not registered.`)
    }
    return definition
  }

  /**
   * Возвращает все зарегистрированные definitions.
   */
  getAll(): ReadonlyArray<AnyModelerElementDefinition> {
    return [...this._definitions.values()]
  }
}

/**
 * Создает registry с базовыми элементами Modeler.
 */
export function createModelerElementRegistry(
  definitions: Array<AnyModelerElementDefinition> = ModelerElementDefinitions,
): ElementRegistry {
  return new ElementRegistry().registerMany(definitions)
}
