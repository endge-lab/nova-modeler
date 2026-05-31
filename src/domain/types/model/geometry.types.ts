export interface ModelerPoint {
  x: number
  y: number
}

export interface ModelerRect extends ModelerPoint {
  width: number
  height: number
}

export interface ModelerViewport {
  x: number
  y: number
  scale: number
}

export type ModelerOverlayPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
