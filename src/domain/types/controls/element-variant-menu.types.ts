import type {
  NovaComponentDescriptor,
} from '@endge/nova'
import type { ModelerController } from '@/domain/types/plugins/controller.types'
import type { ModelerPoint } from '@/domain/types/model/geometry.types'

export interface ElementVariantMenuProps {
  controller?: ModelerController
  elementId?: string
  anchor?: ModelerPoint
  visible?: boolean
  zIndex?: number
  onClose?: () => void
}

export interface ElementVariantMenuResolvedProps {
  controller?: ModelerController
  elementId?: string
  anchor: ModelerPoint
  visible: boolean
  zIndex: number
  onClose?: () => void
}

export interface ElementVariantMenuApi {
  close(): void
  setProps(patch: ElementVariantMenuProps): void
  getProps(): Readonly<ElementVariantMenuResolvedProps>
}

export type ElementVariantMenuDescriptor = NovaComponentDescriptor<
  ElementVariantMenuResolvedProps,
  ElementVariantMenuApi,
  Record<string, never>,
  ElementVariantMenuProps
>
