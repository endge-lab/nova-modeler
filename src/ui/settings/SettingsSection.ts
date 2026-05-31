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
  ModelerSettingsSectionProps,
} from '@/domain/types/index'

export interface ModelerSettingsSectionResolvedProps extends Required<ModelerSettingsSectionProps> {}

export type SettingsSectionDescriptor = NovaComponentDescriptor<
  ModelerSettingsSectionResolvedProps,
  Record<string, never>,
  Record<string, never>,
  ModelerSettingsSectionProps
>

/**
 * Marker-component секции настроек, который читается SettingsDialog.
 */
export class SettingsSection<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ModelerSettingsSectionResolvedProps, Record<string, never>, Record<string, never>, ModelerSettingsSectionProps, E> {
  /**
   * Создает invisible marker-node на случай прямого mount вне SettingsDialog.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: SettingsSectionDescriptor,
    props: ModelerSettingsSectionResolvedProps,
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
 * Нормализует section marker props.
 */
export function normalizeSettingsSectionProps(
  props: Partial<ModelerSettingsSectionProps> = { id: 'custom.section', category: 'canvas' },
): ModelerSettingsSectionResolvedProps {
  const id = props.id ?? 'custom.section'
  return {
    id,
    category: props.category ?? 'canvas',
    title: props.title ?? id,
    order: props.order ?? 100,
    hidden: props.hidden ?? false,
  }
}

/**
 * Создает descriptor SettingsSection.
 */
export function createSettingsSectionDescriptor(
  createNode?: <E extends EventList>(
    context: NovaComponentCreateContext<E>,
    schema: NovaComponentSchema<ModelerSettingsSectionProps>,
  ) => NovaComponentNodeType<
    ModelerSettingsSectionResolvedProps,
    Record<string, never>,
    Record<string, never>,
    ModelerSettingsSectionProps,
    E
  >,
): SettingsSectionDescriptor {
  const descriptor: SettingsSectionDescriptor = {
    type: Modeler.SettingsSection,
    name: 'SettingsSection',
    title: 'SettingsSection',
    version: '0.24.0',
    kind: 'node-component',
    dirtyPolicy: {
      update: ['id', 'category', 'title', 'order', 'hidden'],
      render: [],
    },
    fields: {
      id: { type: 'string', required: true },
      category: { type: 'string', required: true },
      title: { type: 'string' },
      order: { type: 'number' },
      hidden: { type: 'boolean' },
    },
    normalize: schema => normalizeSettingsSectionProps(schema.props),
    measureBounds: () => null,
  }

  descriptor.createNode = createNode ?? ((context, schema) => new SettingsSection(
    context.app,
    context.surface,
    descriptor,
    normalizeSettingsSectionProps(schema.props),
    { componentId: schema.id },
  ))

  return descriptor
}

export const MODELER_SETTINGS_SECTION_DESCRIPTOR = createSettingsSectionDescriptor()
