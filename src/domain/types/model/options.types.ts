import type { ModelerSnapOptions } from '@/domain/types/interaction/snap.types'
import type {
  ModelerKeyboardShortcut,
  ModelerShortcutOptions,
} from '@/domain/types/shortcut.types'
import type { ModelerPaletteOptions } from '@/domain/types/palette.types'

export interface ModelerViewportOptions {
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  wheelZoomSpeed?: number
  panMode?: 'drag-empty' | 'space-drag' | 'both'
}

export interface ModelerInteractionOptions {
  readonly?: boolean
  gridSize?: number
  snap?: false | ModelerSnapOptions
  dragShadow?: boolean
  selection?: ModelerSelectionOptions
  tools?: ModelerInteractionToolsOptions
}

export interface ModelerOptions {
  version?: number
  viewport?: ModelerViewportOptions
  interaction?: ModelerInteractionOptions
  rendering?: ModelerRenderingOptions
  branding?: ModelerBrandingOptions
  palette?: ModelerPaletteOptions
  shortcuts?: ModelerShortcutOptions
}

export interface ModelerRenderingOptions {
  bpmnRecipes?: ModelerBpmnRecipeRenderingOptions
}

export interface ModelerBpmnRecipeRenderingOptions {
  enabled?: boolean
  mode?: 'auto' | 'always' | 'lod' | 'off'
  lodScale?: number
  nodes?: boolean
  edges?: boolean
  text?: 'batch' | 'schema' | 'hide-small'
  culling?: boolean
  diagnostics?: boolean
}

export interface ModelerBrandingOptions {
  visible?: boolean
}

export interface ModelerOptionsRef {
  current: ModelerOptions
  version: number
}

export type ModelerFeatureName = 'marqueeSelection'

export type ModelerSelectionModifier = 'shift' | 'ctrl' | 'meta' | 'alt' | 'none'

export interface ModelerSelectionOptions {
  multiple?: boolean
  additiveModifier?: ModelerSelectionModifier
  toggleModifier?: ModelerSelectionModifier
  marqueeModifier?: ModelerSelectionModifier
  clearOnCanvasPointerDown?: boolean
  selectOnPointerDown?: boolean
  deleteShortcuts?: Array<ModelerKeyboardShortcut>
}

export interface ModelerInteractionToolsOptions {
  activeToolId?: string | null
}
