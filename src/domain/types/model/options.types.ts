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
}

export interface ModelerOptions {
  version?: number
  viewport?: ModelerViewportOptions
  interaction?: ModelerInteractionOptions
}

export interface ModelerOptionsRef {
  current: ModelerOptions
  version: number
}

export type ModelerFeatureName = 'marqueeSelection'
