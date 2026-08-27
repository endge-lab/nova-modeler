import type { NovaApp, NovaComponentCreateContext, NovaComponentDescriptor, NovaComponentNode as NovaComponentNodeType, NovaComponentSchema, NovaElementSchema, NovaElementSlots, NovaSurface } from '@endge/nova'
import type { DialogDefinition, DialogProps, DialogSlotContext, NovaUiLayoutRect, NovaUiLayoutTarget } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type { ModelerSettingsCategoryDefinition, ModelerSettingsDialogPayload, ModelerSettingsDialogProps, ModelerSettingsDialogResolvedProps, ModelerSettingsDialogSchema, ModelerSettingsSectionDefinition, ModelerSettingsSectionSlotContext } from '@/domain/types/index'
import {

  NovaComponentNode,

} from '@endge/nova'
import {

  findNovaUiRoot,
  NOVA_UI_LAYOUT_TARGET,
  NovaUIKit,

} from '@endge/nova-ui-kit'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_SETTINGS_DIALOG_TYPE,

} from '@/domain/types/index'
import { ModelerSettingsRegistry } from '@/model/settings/ModelerSettingsRegistry'

export interface ModelerSettingsDialogApi {
  setProps: (patch: ModelerSettingsDialogProps) => void
  getProps: () => Readonly<ModelerSettingsDialogResolvedProps>
  getRegistry: () => ModelerSettingsRegistry
}

export type SettingsDialogDescriptor = NovaComponentDescriptor<
  ModelerSettingsDialogResolvedProps,
  ModelerSettingsDialogApi,
  Record<string, never>,
  ModelerSettingsDialogProps
>

/**
 * Регистрирует один dialog template настроек Modeler в ближайшем NovaUIKit.Root.
 */
export class SettingsDialog<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ModelerSettingsDialogResolvedProps, ModelerSettingsDialogApi, Record<string, never>, ModelerSettingsDialogProps, E>
  implements NovaUiLayoutTarget {
  readonly [NOVA_UI_LAYOUT_TARGET] = true as const

  private readonly _sourceId: string
  private readonly _registry: ModelerSettingsRegistry
  private readonly _api: ModelerSettingsDialogApi

  /**
   * Создает registry-node для modeler settings dialog.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: SettingsDialogDescriptor,
    props: ModelerSettingsDialogResolvedProps,
    options: {
      componentId?: string
      children?: ModelerSettingsDialogSchema['children']
      slots?: NovaElementSlots
    } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this._sourceId = options.componentId ?? this.id
    this._registry = ModelerSettingsRegistry.fromSchemas([
      ...(options.children ?? []),
      ...(options.slots?.default?.({}) ?? []),
    ])
    this._api = {
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
      getRegistry: () => this._registry,
    }
    this.visible = false
    this.options({ interactive: false })
  }

  /**
   * Возвращает публичный API registry-node.
   */
  override getApi(): ModelerSettingsDialogApi {
    return this._api
  }

  /**
   * Обновляет props диалога и перерегистрирует definition.
   */
  override setProps(patch: ModelerSettingsDialogProps): this {
    super.setProps(patch as Partial<ModelerSettingsDialogResolvedProps>)
    return this
  }

  /**
   * Принимает rect от Root layout без перезаписи dialog definition props.
   */
  applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    const changed = this.x !== rect.x
      || this.y !== rect.y
      || this.width !== rect.width
      || this.height !== rect.height

    this.options({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      interactive: false,
    })
    if (changed) {
      this.dirty({ matrix: true, render: true })
    }
    return changed
  }

  /**
   * Registry-node не участвует в update-фазе.
   */
  update(): void {}

  /**
   * Registry-node ничего не рисует.
   */
  render(): void {}

  /**
   * Регистрирует dialog template после mount.
   */
  protected override onMount(): void {
    super.onMount()
    this._syncRootDefinition()
  }

  /**
   * Снимает dialog template при удалении registry-node.
   */
  protected override onUnmount(): void {
    findNovaUiRoot(this)?.getApi?.().unregisterDialogDefinitions(this._sourceId)
    super.onUnmount()
  }

  /**
   * Реагирует на изменение props.
   */
  protected override onPropsChanged(changedKeys: Array<keyof ModelerSettingsDialogResolvedProps>): void {
    this.props = normalizeModelerSettingsDialogProps(this.props)
    super.onPropsChanged(changedKeys)
    this.visible = false
    this.options({ interactive: false })
    this._syncRootDefinition()
  }

  /**
   * Передает definition ближайшему UI Kit Root.
   */
  private _syncRootDefinition(): void {
    const definition: DialogDefinition = {
      type: this.props.type,
      props: this._createDialogProps(),
      slot: slot => this._createDialogBody(slot),
    }
    findNovaUiRoot(this)?.getApi?.().registerDialogDefinitions(this._sourceId, [definition])
  }

  /**
   * Создает базовые props для UI Kit Dialog.
   */
  private _createDialogProps(): DialogProps {
    return {
      title: this.props.title,
      description: this.props.description,
      width: this.props.width,
      height: this.props.height,
      minWidth: this.props.minWidth,
      minHeight: this.props.minHeight,
      modal: this.props.modal,
      backdrop: this.props.backdrop,
      closeButton: this.props.closeButton,
      draggable: this.props.draggable,
      resizable: this.props.resizable,
      placement: 'center',
      background: 'var(--nova-modeler-settings-background, #ffffff)',
      color: 'var(--nova-modeler-settings-color, #172033)',
      border: {
        color: 'var(--nova-modeler-settings-border-color, #cbd5e1)',
        width: 1,
        radius: 10,
      },
      padding: {
        horizontal: 18,
        vertical: 16,
      },
    } as DialogProps
  }

  /**
   * Создает body schema с левой навигацией и секциями выбранной категории.
   */
  private _createDialogBody(slot: DialogSlotContext): Array<NovaElementSchema<any>> {
    const dialogProps = slot.props as DialogProps & { width: number, height: number }
    const categories = this._registry.getCategories()
    const activeCategory = this._resolveActiveCategory(slot, categories)
    const sections = activeCategory ? this._registry.getSections(activeCategory.id) : []

    return [{
      type: NovaUIKit.Flex,
      id: `${slot.id}:settings-layout`,
      props: {
        row: true,
        gap: 16,
        width: Math.max(0, dialogProps.width - 36),
        height: Math.max(0, dialogProps.height - 108),
        clip: true,
      },
      children: [
        this._createCategoriesPane(slot, categories, activeCategory?.id),
        this._createSectionsPane(slot, activeCategory, sections),
      ],
    }]
  }

  /**
   * Создает левый список категорий.
   */
  private _createCategoriesPane(
    slot: DialogSlotContext,
    categories: Array<ModelerSettingsCategoryDefinition>,
    activeCategoryId: string | undefined,
  ): NovaElementSchema<any> {
    return {
      type: NovaUIKit.Flex,
      id: `${slot.id}:settings-categories`,
      layout: {
        width: 184,
        height: '100%',
        flexShrink: 0,
      },
      props: {
        col: true,
        gap: 6,
        justifyContent: 'start',
        alignItems: 'start',
        padding: { top: 2, right: 10, bottom: 2, left: 0 },
      },
      children: categories.map(category => ({
        type: NovaUIKit.Button,
        id: `${slot.id}:settings-category:${category.id}`,
        props: {
          text: category.title,
          position: 'static',
          size: 'sm',
          textAlign: 'left',
          width: 168,
          height: 34,
          variant: category.id === activeCategoryId ? 'primary' : 'ghost',
          selected: category.id === activeCategoryId,
          onPress: () => slot.update({ activeCategoryId: category.id } as DialogProps),
        },
      })),
    }
  }

  /**
   * Создает правую область секций.
   */
  private _createSectionsPane(
    slot: DialogSlotContext,
    category: ModelerSettingsCategoryDefinition | undefined,
    sections: Array<ModelerSettingsSectionDefinition>,
  ): NovaElementSchema<any> {
    const children: Array<NovaElementSchema<any>> = []
    if (category) {
      children.push({
        type: NovaUIKit.TextBlock,
        id: `${slot.id}:settings-category-title`,
        props: {
          text: category.title,
          width: 480,
          height: 26,
          fontSize: 16,
          fontWeight: '800',
          color: '#172033',
        },
      })
    }

    if (sections.length === 0) {
      children.push(this._createEmptyState(slot))
    }
    else {
      for (const section of sections) {
        children.push(...this._createSection(slot, category, section))
      }
    }

    return {
      type: NovaUIKit.Flex,
      id: `${slot.id}:settings-sections`,
      layout: {
        flexGrow: 1,
        height: '100%',
      },
      props: {
        col: true,
        gap: 12,
        padding: { top: 2, right: 2, bottom: 2, left: 0 },
        clip: true,
      },
      children,
    }
  }

  /**
   * Создает одну секцию настроек.
   */
  private _createSection(
    slot: DialogSlotContext,
    category: ModelerSettingsCategoryDefinition | undefined,
    section: ModelerSettingsSectionDefinition,
  ): Array<NovaElementSchema<any>> {
    const sectionContext = this._createSectionContext(slot, category, section)
    const body = section.slot?.(sectionContext) ?? section.children
    return [
      {
        type: NovaUIKit.TextBlock,
        id: `${slot.id}:settings-section-title:${section.id}`,
        props: {
          text: section.title,
          width: 480,
          height: 22,
          fontSize: 12,
          fontWeight: '800',
          color: '#475569',
        },
      },
      ...body,
    ]
  }

  /**
   * Создает scope для пользовательского slot секции.
   */
  private _createSectionContext(
    slot: DialogSlotContext,
    category: ModelerSettingsCategoryDefinition | undefined,
    section: ModelerSettingsSectionDefinition,
  ): ModelerSettingsSectionSlotContext {
    const payload = slot as ModelerSettingsDialogPayload & DialogSlotContext
    return {
      ...slot,
      category: category ?? {
        id: section.category,
        title: section.category,
        order: 100,
        hidden: false,
      },
      section,
      settings: payload.settings ?? {},
      actions: payload.actions ?? {},
    }
  }

  /**
   * Создает состояние пустой категории.
   */
  private _createEmptyState(slot: DialogSlotContext): NovaElementSchema<any> {
    return {
      type: NovaUIKit.TextBlock,
      id: `${slot.id}:settings-empty`,
      props: {
        text: 'В этой категории пока нет настроек.',
        width: 480,
        height: 28,
        fontSize: 12,
        color: '#64748b',
      },
    }
  }

  /**
   * Возвращает активную категорию с fallback на первую видимую.
   */
  private _resolveActiveCategory(
    slot: DialogSlotContext,
    categories: Array<ModelerSettingsCategoryDefinition>,
  ): ModelerSettingsCategoryDefinition | undefined {
    const payload = slot as ModelerSettingsDialogPayload & DialogSlotContext
    const activeId = payload.activeCategoryId ?? this.props.defaultCategory
    return categories.find(category => category.id === activeId) ?? categories[0]
  }
}

/**
 * Нормализует props registry-node настроек.
 */
export function normalizeModelerSettingsDialogProps(
  props: ModelerSettingsDialogProps = {},
): ModelerSettingsDialogResolvedProps {
  return {
    type: props.type ?? MODELER_SETTINGS_DIALOG_TYPE,
    title: props.title ?? 'Настройки',
    description: props.description ?? '',
    width: props.width ?? 760,
    height: props.height ?? 520,
    minWidth: props.minWidth ?? 620,
    minHeight: props.minHeight ?? 420,
    defaultCategory: props.defaultCategory ?? 'canvas',
    modal: props.modal ?? true,
    backdrop: props.backdrop ?? true,
    closeButton: props.closeButton ?? true,
    draggable: props.draggable ?? true,
    resizable: props.resizable ?? false,
  }
}

/**
 * Создает descriptor SettingsDialog.
 */
export function createSettingsDialogDescriptor(
  createNode?: <E extends EventList>(
    context: NovaComponentCreateContext<E>,
    schema: NovaComponentSchema<ModelerSettingsDialogProps>,
  ) => NovaComponentNodeType<
    ModelerSettingsDialogResolvedProps,
    ModelerSettingsDialogApi,
    Record<string, never>,
    ModelerSettingsDialogProps,
    E
  >,
): SettingsDialogDescriptor {
  const descriptor: SettingsDialogDescriptor = {
    type: Modeler.SettingsDialog,
    name: 'SettingsDialog',
    title: 'SettingsDialog',
    version: '0.24.0',
    kind: 'node-component',
    dirtyPolicy: {
      update: ['type', 'title', 'description', 'width', 'height', 'defaultCategory'],
      render: [],
    },
    fields: {
      type: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      width: { type: 'number' },
      height: { type: 'number' },
      minWidth: { type: 'number' },
      minHeight: { type: 'number' },
      defaultCategory: { type: 'string' },
      modal: { type: 'boolean' },
      backdrop: { type: 'boolean' },
      closeButton: { type: 'boolean' },
      draggable: { type: 'boolean' },
      resizable: { type: 'boolean' },
    },
    normalize: schema => normalizeModelerSettingsDialogProps(schema.props),
    measureBounds: () => null,
  }

  descriptor.createNode = createNode ?? ((context, schema) => {
    const settingsSchema = schema as ModelerSettingsDialogSchema
    return new SettingsDialog(
      context.app,
      context.surface,
      descriptor,
      normalizeModelerSettingsDialogProps(settingsSchema.props),
      {
        componentId: settingsSchema.id,
        children: settingsSchema.children,
        slots: settingsSchema.slots,
      },
    )
  })

  return descriptor
}

export const MODELER_SETTINGS_DIALOG_DESCRIPTOR = createSettingsDialogDescriptor()
