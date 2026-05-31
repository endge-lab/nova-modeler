export type ModelerPortSide = 'top' | 'right' | 'bottom' | 'left' | 'center'

export interface ModelerPort {
  id: string
  elementId: string
  side: ModelerPortSide
  x: number
  y: number
  radius?: number
}
