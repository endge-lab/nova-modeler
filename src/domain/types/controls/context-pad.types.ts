import type {
  NovaComponentDescriptor,
  NovaTemplateChildSchema,
} from '@endge/nova'
import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerRect } from '@/domain/types/model/geometry.types'
import type {
  ModelerController,
} from '@/domain/types/plugins/controller.types'
import type { ModelerPluginContext } from '@/domain/types/plugins/plugin.types'

export type ContextPadPlacement = 'right'

export interface ContextPadPosition {
  x: number
  y: number
}

export interface ContextPadTarget {
  type: 'element'
  element: ModelerElement
  screenBounds: ModelerRect
}

export interface ContextPadEntry {
  id: string
  title: string
  tone: 'default' | 'danger'
}

export interface ContextPadSlotProps {
  target: ContextPadTarget
  element: ModelerElement
  context: ModelerController | ModelerPluginContext
  entries: Array<ContextPadEntry>
  position: ContextPadPosition
  run(entry: ContextPadEntry): void
  close(): void
}

export interface ContextPadLayoutSlotProps extends ContextPadSlotProps {
  content: Array<NovaTemplateChildSchema>
}

export interface ContextPadProps {
  controller?: ModelerController
  placement?: ContextPadPlacement
  offset?: number
  visible?: boolean
  zIndex?: number
}

export interface ContextPadResolvedProps {
  controller?: ModelerController
  placement: ContextPadPlacement
  offset: number
  visible: boolean
  zIndex: number
}

export interface ContextPadApi {
  close(): void
  closeMenus(): void
  setProps(patch: ContextPadProps): void
  getProps(): Readonly<ContextPadResolvedProps>
}

export type ContextPadDescriptor = NovaComponentDescriptor<
  ContextPadResolvedProps,
  ContextPadApi,
  Record<string, never>,
  ContextPadProps
>
