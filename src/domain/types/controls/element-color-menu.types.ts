import type {
  NovaComponentDescriptor,
} from '@endge/nova'
import type { ModelerController } from '@/domain/types/plugins/controller.types'
import type { ModelerPoint } from '@/domain/types/model/geometry.types'

export interface ElementColorMenuProps {
  controller?: ModelerController
  elementId?: string
  part?: {
    partType: string
    partId: string
  }
  anchor?: ModelerPoint
  visible?: boolean
  zIndex?: number
  onClose?: () => void
}

export interface ElementColorMenuResolvedProps {
  controller?: ModelerController
  elementId?: string
  part?: {
    partType: string
    partId: string
  }
  anchor: ModelerPoint
  visible: boolean
  zIndex: number
  onClose?: () => void
}

export interface ElementColorMenuApi {
  close(): void
  setProps(patch: ElementColorMenuProps): void
  getProps(): Readonly<ElementColorMenuResolvedProps>
}

export type ElementColorMenuDescriptor = NovaComponentDescriptor<
  ElementColorMenuResolvedProps,
  ElementColorMenuApi,
  Record<string, never>,
  ElementColorMenuProps
>
