import type {
  NovaComponentDescriptor,
  NovaComponentSchema,
  NovaElementSchema,
  NovaElementSlotFactory,
  NovaTemplateChildSchema,
} from '@endge/nova'
import type {
  DialogProps,
  DialogSlotContext,
  NovaUiComponentSize,
  NovaUiInset,
  NovaUiPosition,
} from '@endge/nova-ui-kit'

export const MODELER_SETTINGS_DIALOG_TYPE = 'modeler-settings'

export type ModelerSettingsBuiltInCategoryId = 'canvas' | 'interaction' | 'view' | 'theme'
export type ModelerSettingsCategoryId = ModelerSettingsBuiltInCategoryId | string

export interface ModelerSettingsDialogProps {
  type?: string
  title?: string
  description?: string
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  defaultCategory?: ModelerSettingsCategoryId
  modal?: boolean
  backdrop?: boolean
  closeButton?: boolean
  draggable?: boolean
  resizable?: boolean
}

export interface ModelerSettingsDialogResolvedProps extends Required<ModelerSettingsDialogProps> {}

export interface ModelerSettingsCategoryProps {
  id: ModelerSettingsCategoryId
  title?: string
  order?: number
  icon?: string
  hidden?: boolean
}

export interface ModelerSettingsSectionProps {
  id: string
  category: ModelerSettingsCategoryId
  title?: string
  order?: number
  hidden?: boolean
}

export interface ModelerSettingsCategoryDefinition {
  id: ModelerSettingsCategoryId
  title: string
  order: number
  icon?: string
  hidden: boolean
}

export interface ModelerSettingsDialogPayload extends Record<string, unknown> {
  activeCategoryId?: ModelerSettingsCategoryId
  settings?: Record<string, unknown>
  actions?: Record<string, unknown>
}

export interface ModelerSettingsSectionSlotContext extends DialogSlotContext {
  category: ModelerSettingsCategoryDefinition
  section: ModelerSettingsSectionDefinition
  settings: Record<string, unknown>
  actions: Record<string, unknown>
}

export interface ModelerSettingsSectionDefinition {
  id: string
  category: ModelerSettingsCategoryId
  title: string
  order: number
  hidden: boolean
  slot?: NovaElementSlotFactory<ModelerSettingsSectionSlotContext>
  children: Array<NovaElementSchema<any>>
}

export interface ModelerSettingsDialogSchema extends NovaComponentSchema<ModelerSettingsDialogProps> {
  children?: Array<ModelerSettingsCategorySchema | ModelerSettingsSectionSchema>
}

export type ModelerSettingsCategorySchema = NovaComponentSchema<ModelerSettingsCategoryProps>

export interface ModelerSettingsSectionSchema extends NovaComponentSchema<ModelerSettingsSectionProps> {
  children?: Array<NovaElementSchema<any>>
}

export interface ModelerSettingsControllerOptions {
  root: () => {
    openDialog: (input: string | ({ type?: string; id?: string } & Record<string, unknown>), payload?: Record<string, unknown>) => string
    closeDialog: (id?: string, event?: Event) => void
    updateDialog: (id: string, patch: DialogProps & Record<string, unknown>) => void
    getOpenDialogIds: () => Array<string>
  } | null | undefined
  type?: string
  id?: string
}

export interface ModelerSettingsButtonSlotProps {
  selected: boolean
  toggle(event?: Event): void
  open(event?: Event): void
  close(event?: Event): void
}

export interface ModelerSettingsButtonProps {
  payload?: ModelerSettingsDialogPayload
  payloadFactory?: () => ModelerSettingsDialogPayload
  rootId?: string
  type?: string
  dialogId?: string
  position?: NovaUiPosition
  inset?: NovaUiInset
  width?: number
  height?: number
  size?: NovaUiComponentSize
  zIndex?: number
  visible?: boolean
}

export interface ModelerSettingsButtonResolvedProps extends Required<Omit<ModelerSettingsButtonProps, 'payload' | 'payloadFactory' | 'rootId' | 'type' | 'dialogId' | 'inset' | 'zIndex'>> {
  payload?: ModelerSettingsDialogPayload
  payloadFactory?: () => ModelerSettingsDialogPayload
  rootId?: string
  type?: string
  dialogId?: string
  inset?: NovaUiInset
  zIndex?: number
}

export interface ModelerSettingsButtonApi {
  open(event?: Event): void
  close(event?: Event): void
  toggle(event?: Event): void
  isOpen(): boolean
  setProps(patch: ModelerSettingsButtonProps): void
  getProps(): Readonly<ModelerSettingsButtonResolvedProps>
}

export interface ModelerSettingsButtonSchema {
  children?: Array<NovaTemplateChildSchema>
  slots?: {
    default?: NovaElementSlotFactory<ModelerSettingsButtonSlotProps>
  }
}

export type ModelerSettingsButtonDescriptor = NovaComponentDescriptor<
  ModelerSettingsButtonResolvedProps,
  ModelerSettingsButtonApi,
  Record<string, never>,
  ModelerSettingsButtonProps
>
