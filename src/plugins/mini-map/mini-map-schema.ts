import type { NovaSchema } from '@endge/nova'
import type { ModelerLayout, ModelerRect } from '@/domain/types/index'

export interface MiniMapLayout extends ModelerRect {
  content: ModelerRect
  viewport: ModelerRect
}

export interface MiniMapTheme {
  background: string
  borderColor: string
  contentBackground: string
  viewportBackground: string
  viewportBorderColor: string
}

export function createMiniMapLayout(
  layout: ModelerLayout,
  width: number,
  height: number,
  margin: number,
  placement: string,
  rect?: ModelerRect,
): MiniMapLayout {
  const x = rect?.x ?? (placement.includes('right') ? layout.width - width - margin : margin)
  const y = rect?.y ?? (placement.includes('bottom') ? layout.height - height - margin : margin)
  const pad = 0
  const content = { x: x + pad, y: y + pad, width: width - pad * 2, height: height - pad * 2 }
  const scale = Math.min(content.width / layout.worldBounds.width, content.height / layout.worldBounds.height)
  const worldToMini = (worldX: number, worldY: number) => ({
    x: content.x + (worldX - layout.worldBounds.x) * scale,
    y: content.y + (worldY - layout.worldBounds.y) * scale,
  })
  const topLeft = worldToMini(-layout.viewport.x / layout.viewport.scale, -layout.viewport.y / layout.viewport.scale)
  const bottomRight = worldToMini(
    (layout.width - layout.viewport.x) / layout.viewport.scale,
    (layout.height - layout.viewport.y) / layout.viewport.scale,
  )
  const viewport = clampRect({
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  }, content)
  return { x, y, width, height, content, viewport }
}

export function createMiniMapSchema(layout: MiniMapLayout, theme: MiniMapTheme): NovaSchema {
  return [
    { type: 'rect', x: layout.x, y: layout.y, width: layout.width, height: layout.height, styles: { background: theme.background, border: { color: theme.borderColor, width: 1 } } },
    { type: 'rect', x: layout.content.x, y: layout.content.y, width: layout.content.width, height: layout.content.height, styles: { background: theme.contentBackground } },
    { type: 'rect', x: layout.viewport.x, y: layout.viewport.y, width: layout.viewport.width, height: layout.viewport.height, styles: { background: theme.viewportBackground, border: { color: theme.viewportBorderColor, width: 1.5 } } },
  ] as NovaSchema
}

function clampRect(rect: ModelerRect, bounds: ModelerRect): ModelerRect {
  const minWidth = Math.min(2, bounds.width)
  const minHeight = Math.min(2, bounds.height)
  const x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - minWidth, rect.x))
  const y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - minHeight, rect.y))
  const maxWidth = bounds.x + bounds.width - x
  const maxHeight = bounds.y + bounds.height - y
  return {
    x,
    y,
    width: Math.max(minWidth, Math.min(maxWidth, rect.width)),
    height: Math.max(minHeight, Math.min(maxHeight, rect.height)),
  }
}
