import type { NovaComponentDescriptor } from '@endge/nova'
import type {
  NovaUiInset,
  NovaUiPosition,
} from '@endge/nova-ui-kit'
import type { ModelerController } from '@/domain/types/plugins/controller.types'
import type {
  ModelerPaletteItemDefinition,
  ModelerPalettePlacement,
} from '@/domain/types/palette/palette.types'

export interface PaletteItemLayout {
  type: 'item'
  item: ModelerPaletteItemDefinition
  x: number
  y: number
  size: number
}

export interface PaletteDividerLayout {
  type: 'divider'
  x: number
  y: number
  width: number
  height: number
}

export interface PaletteGripLayout {
  type: 'grip'
  x: number
  y: number
  width: number
  height: number
}

export type PaletteLayoutEntry = PaletteItemLayout | PaletteDividerLayout | PaletteGripLayout

export interface PaletteProps {
  controller?: ModelerController
  placement?: ModelerPalettePlacement
  draggable?: boolean
  offset?: number
  itemSize?: number
  gap?: number
  padding?: number
  gripSize?: number
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
  placement?: ModelerPalettePlacement
  draggable?: boolean
  offset?: number
  itemSize?: number
  gap?: number
  padding?: number
  gripSize?: number
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
