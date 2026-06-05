import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerElementRegistry } from '@/domain/types/elements/element-registry.types'
import type { ModelerPoint, ModelerRect, ModelerViewport } from '@/domain/types/model/geometry.types'

export interface ModelerExternalLabelGeometry {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export interface ModelerExternalLabelLine {
  text: string
  x: number
  y: number
  width: number
  widthLimit: number
  height: number
}

export interface ModelerExternalLabelLayout {
  elementId: string
  text: string
  worldRect: ModelerRect
  screenRect: ModelerRect
  worldAnchor: ModelerPoint
  screenAnchor: ModelerPoint
  worldConnectorStart: ModelerPoint
  worldConnectorEnd: ModelerPoint
  screenConnectorStart: ModelerPoint
  screenConnectorEnd: ModelerPoint
  lines: Array<ModelerExternalLabelLine>
  worldLines?: Array<ModelerExternalLabelLine>
  fontFamily: string
  fontSize: number
  worldFontSize?: number
  fontWeight: '500'
  lineHeight: number
  worldLineHeight?: number
  clipped: boolean
}

export interface ModelerExternalLabelSelectedPart {
  elementId: string
  partId: 'label'
}

export interface ModelerExternalLabelResolveContext {
  getViewport(): ModelerViewport
  worldToScreen(point: ModelerPoint): ModelerPoint
  getElementRegistry(): ModelerElementRegistry
}

export interface ModelerExternalLabelAdapter<TElement extends ModelerElement = ModelerElement> {
  getText(context: ModelerExternalLabelResolveContext, element: TElement): string
  setText?(context: ModelerExternalLabelResolveContext, element: TElement, text: string): TElement
  getDefaultRect(context: ModelerExternalLabelResolveContext, element: TElement): ModelerRect
  getAnchorPoint(context: ModelerExternalLabelResolveContext, element: TElement): ModelerPoint
}

export interface ModelerExternalLabelApi {
  resolve(context: ModelerExternalLabelResolveContext, element: ModelerElement): ModelerExternalLabelLayout | null
  resolveBounds(context: ModelerExternalLabelResolveContext, element: ModelerElement): ModelerRect | null
  hitTest(context: ModelerExternalLabelResolveContext, element: ModelerElement, worldPoint: ModelerPoint): boolean
  createGeometry(context: ModelerExternalLabelResolveContext, element: ModelerElement, rect?: ModelerRect): ModelerExternalLabelGeometry | null
  moveGeometry(geometry: ModelerExternalLabelGeometry, dx: number, dy: number): ModelerExternalLabelGeometry
  resizeGeometry(geometry: ModelerExternalLabelGeometry, handle: string, dx: number, dy: number): ModelerExternalLabelGeometry
  getSelected(): ModelerExternalLabelSelectedPart | null
  select(elementId: string | null): void
  clearSelection(): void
  isSelected(elementId: string): boolean
  subscribe(listener: () => void): () => void
}
