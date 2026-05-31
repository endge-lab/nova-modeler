export type ModelerResizeHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw'

export interface ModelerResizeHandleDescriptor {
  elementId: string
  handle: ModelerResizeHandle
  x: number
  y: number
  size: number
  cursor: string
}

export interface ModelerRotateHandleDescriptor {
  elementId: string
  x: number
  y: number
  size: number
  cursor: string
}
