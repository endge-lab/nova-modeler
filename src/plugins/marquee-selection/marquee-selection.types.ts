import type { ModelerRect } from '@/domain/types/index'

export interface MarqueeSelectionController {
  readonly enabled: boolean
  setEnabled(enabled: boolean): void
  toggle(): void
  __bind(adapter: MarqueeSelectionControllerAdapter): () => void
}

export interface MarqueeSelectionControllerAdapter {
  invalidate(): void
  onSelectionComplete(ids: Array<string>): void
}

export interface MarqueeSelectionControllerOptions {
  enabled?: boolean
  onEnabledChange?: (enabled: boolean) => void
}

export interface MarqueeSelectionPluginOptions {
  id?: string
  enabled?: boolean
  controller?: MarqueeSelectionController
  minDragPx?: number
  onSelectionComplete?: (ids: Array<string>) => void
}

export interface MarqueeSelectionDraft {
  start: ModelerRect
  current: ModelerRect
}
