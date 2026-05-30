import type { ModelerOverlayPlacement } from '@/domain/types/index'

export interface MiniMapController {
  readonly visible: boolean
  setVisible(visible: boolean): void
  toggle(): void
  __bind(adapter: MiniMapControllerAdapter): () => void
}

export interface MiniMapControllerAdapter {
  invalidate(): void
}

export interface MiniMapControllerOptions {
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
}

export interface MiniMapPluginOptions {
  id?: string
  visible?: boolean
  controller?: MiniMapController
  placement?: ModelerOverlayPlacement
  width?: number
  height?: number
  margin?: number
  draggableViewport?: boolean
}
