import type { NovaComponentDescriptor } from '@endge/nova'
import type {
  NovaUiInset,
  NovaUiPosition,
} from '@endge/nova-ui-kit'
import type { ModelerController } from '@/domain/types/plugins/controller.types'

export type PaletteItemType = 'basic.rect' | 'bpmn.event'

export interface PaletteItemLayout {
  type: PaletteItemType
  x: number
  y: number
  size: number
}

export interface PaletteProps {
  controller?: ModelerController
  x?: number
  y?: number
  width?: number
  height?: number
  position?: NovaUiPosition
  inset?: NovaUiInset
  zIndex?: number
  visible?: boolean
}

export interface PaletteResolvedProps {
  controller?: ModelerController
  x: number
  y: number
  width: number
  height: number
  position: NovaUiPosition
  inset?: NovaUiInset
  zIndex?: number
  visible: boolean
}

export interface PaletteApi {
  createRect(): void
  createBpmnEvent(): void
  setProps(patch: PaletteProps): void
  getProps(): Readonly<PaletteResolvedProps>
}

export type PaletteDescriptor = NovaComponentDescriptor<
  PaletteResolvedProps,
  PaletteApi,
  Record<string, never>,
  PaletteProps
>
