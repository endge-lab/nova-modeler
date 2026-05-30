export type ModelerGridVariant = 'dots'

export interface ModelerGridProps {
  visible?: boolean
  variant?: ModelerGridVariant
  gridSize?: number
  color?: string
}

export interface ModelerGridResolvedProps {
  visible: boolean
  variant: ModelerGridVariant
  gridSize?: number
  color?: string
}

export interface ModelerGridRenderPlanInput {
  width: number
  height: number
  gridSize: number
  scale: number
  viewportX: number
  viewportY: number
  minScreenSpacing?: number
  maxDots?: number
}

export interface ModelerGridRenderPlan {
  width: number
  height: number
  spacing: number
  offsetX: number
  offsetY: number
  radius: number
  columns: number
  rows: number
  dotCount: number
}
