import {
  NovaComponentNode,
  type NovaApp,
  type NovaComponentCreateContext,
  type NovaComponentDescriptor,
  type NovaComponentNode as NovaComponentNodeType,
  type NovaComponentSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { Modeler } from '@/config/schema.config'
import type {
  ModelerSettingsCategoryProps,
} from '@/domain/types/index'

export interface ModelerSettingsCategoryResolvedProps extends Required<ModelerSettingsCategoryProps> {}

export type SettingsCategoryDescriptor = NovaComponentDescriptor<
  ModelerSettingsCategoryResolvedProps,
  Record<string, never>,
  Record<string, never>,
  ModelerSettingsCategoryProps
>

/**
 * Marker-component категории настроек, который читается SettingsDialog.
 */
export class SettingsCategory<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ModelerSettingsCategoryResolvedProps, Record<string, never>, Record<string, never>, ModelerSettingsCategoryProps, E> {
  /**
   * Создает invisible marker-node на случай прямого mount вне SettingsDialog.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: SettingsCategoryDescriptor,
    props: ModelerSettingsCategoryResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.visible = false
    this.options({ interactive: false })
  }

  update(): void {}

  render(): void {}
}

/**
 * Нормализует category marker props.
 */
export function normalizeSettingsCategoryProps(
  props: Partial<ModelerSettingsCategoryProps> = { id: 'custom' },
): ModelerSettingsCategoryResolvedProps {
  const id = props.id ?? 'custom'
  return {
    id,
    title: props.title ?? id,
    order: props.order ?? 100,
    icon: props.icon ?? '',
    hidden: props.hidden ?? false,
  }
}

/**
 * Создает descriptor SettingsCategory.
 */
export function createSettingsCategoryDescriptor(
  createNode?: <E extends EventList>(
    context: NovaComponentCreateContext<E>,
    schema: NovaComponentSchema<ModelerSettingsCategoryProps>,
  ) => NovaComponentNodeType<
    ModelerSettingsCategoryResolvedProps,
    Record<string, never>,
    Record<string, never>,
    ModelerSettingsCategoryProps,
    E
  >,
): SettingsCategoryDescriptor {
  const descriptor: SettingsCategoryDescriptor = {
    type: Modeler.SettingsCategory,
    name: 'SettingsCategory',
    title: 'SettingsCategory',
    version: '0.24.0',
    kind: 'node-component',
    dirtyPolicy: {
      update: ['id', 'title', 'order', 'hidden'],
      render: [],
    },
    fields: {
      id: { type: 'string', required: true },
      title: { type: 'string' },
      order: { type: 'number' },
      icon: { type: 'string' },
      hidden: { type: 'boolean' },
    },
    normalize: schema => normalizeSettingsCategoryProps(schema.props),
    measureBounds: () => null,
  }

  descriptor.createNode = createNode ?? ((context, schema) => new SettingsCategory(
    context.app,
    context.surface,
    descriptor,
    normalizeSettingsCategoryProps(schema.props),
    { componentId: schema.id },
  ))

  return descriptor
}

export const MODELER_SETTINGS_CATEGORY_DESCRIPTOR = createSettingsCategoryDescriptor()
