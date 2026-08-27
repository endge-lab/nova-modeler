import type {
  NovaElementSchema,
} from '@endge/nova'
import type {
  ModelerSettingsCategoryDefinition,
  ModelerSettingsCategoryProps,
  ModelerSettingsCategorySchema,
  ModelerSettingsSectionDefinition,
  ModelerSettingsSectionProps,
  ModelerSettingsSectionSchema,
} from '@/domain/types/index'
import { Modeler } from '@/config/schema.config'

const BUILT_IN_CATEGORIES: Array<ModelerSettingsCategoryDefinition> = [
  { id: 'canvas', title: 'Холст', order: 10, hidden: false },
  { id: 'interaction', title: 'Взаимодействие', order: 20, hidden: false },
  { id: 'view', title: 'Вид', order: 30, hidden: false },
  { id: 'theme', title: 'Тема', order: 40, hidden: false },
]

/**
 * Хранит категории и секции диалога настроек, собранные из DSL schema.
 */
export class ModelerSettingsRegistry {
  private readonly _categories = new Map<string, ModelerSettingsCategoryDefinition>()
  private readonly _sections = new Map<string, ModelerSettingsSectionDefinition>()

  /**
   * Создает registry с базовыми категориями Modeler.
   */
  constructor() {
    for (const category of BUILT_IN_CATEGORIES) {
      this.registerCategory(category)
    }
  }

  /**
   * Собирает registry из children компонента SettingsDialog.
   */
  static fromSchemas(children: Array<NovaElementSchema<any>> = []): ModelerSettingsRegistry {
    const registry = new ModelerSettingsRegistry()
    registry.registerSchemas(children)
    return registry
  }

  /**
   * Регистрирует category/section schemas из DSL.
   */
  registerSchemas(children: Array<NovaElementSchema<any>>): void {
    for (const child of children) {
      if (child.type === Modeler.SettingsCategory) {
        this.registerCategory(this._normalizeCategory(child as ModelerSettingsCategorySchema))
      }
      if (child.type === Modeler.SettingsSection) {
        this.registerSection(this._normalizeSection(child as ModelerSettingsSectionSchema))
      }
    }
  }

  /**
   * Возвращает отсортированные видимые категории.
   */
  getCategories(): Array<ModelerSettingsCategoryDefinition> {
    return [...this._categories.values()]
      .filter(category => !category.hidden)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  }

  /**
   * Возвращает категорию по id.
   */
  getCategory(id: string): ModelerSettingsCategoryDefinition | undefined {
    return this._categories.get(id)
  }

  /**
   * Возвращает отсортированные видимые секции категории.
   */
  getSections(categoryId: string): Array<ModelerSettingsSectionDefinition> {
    return [...this._sections.values()]
      .filter(section => !section.hidden && section.category === categoryId)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  }

  /**
   * Добавляет или заменяет категорию.
   */
  registerCategory(category: ModelerSettingsCategoryDefinition): void {
    this._categories.set(category.id, category)
  }

  /**
   * Добавляет или заменяет секцию.
   */
  registerSection(section: ModelerSettingsSectionDefinition): void {
    this._sections.set(section.id, section)
  }

  /**
   * Нормализует категорию из DSL props.
   */
  private _normalizeCategory(schema: ModelerSettingsCategorySchema): ModelerSettingsCategoryDefinition {
    const props = schema.props as Partial<ModelerSettingsCategoryProps> | undefined
    const id = props?.id ?? schema.id ?? 'custom'
    return {
      id,
      title: props?.title ?? id,
      order: props?.order ?? 100,
      icon: props?.icon,
      hidden: props?.hidden ?? false,
    }
  }

  /**
   * Нормализует секцию из DSL schema.
   */
  private _normalizeSection(schema: ModelerSettingsSectionSchema): ModelerSettingsSectionDefinition {
    const props = schema.props as Partial<ModelerSettingsSectionProps> | undefined
    const id = props?.id ?? schema.id ?? 'custom.section'
    return {
      id,
      category: props?.category ?? 'canvas',
      title: props?.title ?? id,
      order: props?.order ?? 100,
      hidden: props?.hidden ?? false,
      slot: schema.slots?.default,
      children: schema.children ?? [],
    }
  }
}
