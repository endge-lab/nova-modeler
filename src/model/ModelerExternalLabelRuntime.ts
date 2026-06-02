import type {
  ModelerElement,
  ModelerExternalLabelApi,
  ModelerExternalLabelGeometry,
  ModelerExternalLabelLayout,
  ModelerExternalLabelLine,
  ModelerExternalLabelResolveContext,
  ModelerExternalLabelSelectedPart,
  ModelerPoint,
  ModelerRect,
} from '@/domain/types/index'

const LABEL_FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const LABEL_FONT_WEIGHT = '500' as const
const LABEL_FONT_SIZE = 12
const LABEL_LINE_HEIGHT = 16
const LABEL_MIN_WIDTH = 48
const LABEL_MIN_HEIGHT = 22
const LABEL_MAX_AUTO_LINES = 3
const LABEL_ELLIPSIS = '...'

export class ModelerExternalLabelRuntime implements ModelerExternalLabelApi {
  private selected: ModelerExternalLabelSelectedPart | null = null
  private readonly listeners = new Set<() => void>()

  resolve(context: ModelerExternalLabelResolveContext, element: ModelerElement): ModelerExternalLabelLayout | null {
    const adapter = context.getElementRegistry().get(element.type)?.externalLabel
    if (!adapter) return null
    const text = normalizeLabelText(adapter.getText(context, element))
    const geometry = this.resolveGeometry(context, element)
    if (!geometry && !text) return null
    const anchor = adapter.getAnchorPoint(context, element)
    const rect = geometry
      ? {
          x: anchor.x + geometry.offsetX,
          y: anchor.y + geometry.offsetY,
          width: Math.max(LABEL_MIN_WIDTH, geometry.width),
          height: Math.max(LABEL_MIN_HEIGHT, geometry.height),
        }
      : adapter.getDefaultRect(context, element)
    const lines = this.createLines(text, rect)
    const visibleLines = lines.slice(0, Math.max(1, Math.floor(rect.height / LABEL_LINE_HEIGHT)))
    const clipped = lines.length > visibleLines.length || visibleLines.some(line => line.width > rect.width)
    if (clipped && visibleLines.length > 0) {
      const lastIndex = visibleLines.length - 1
      visibleLines[lastIndex] = this.createLine(
        fitTextWithEllipsis(visibleLines[lastIndex]?.text ?? '', rect.width),
        rect,
        lastIndex,
      )
    }
    const connectorStart = anchor
    const connectorEnd = nearestRectPoint(rect, anchor)
    const screenRect = this.worldRectToScreen(context, rect)
    const screenAnchor = context.worldToScreen(anchor)
    return {
      elementId: element.id,
      text,
      worldRect: rect,
      screenRect,
      worldAnchor: connectorStart,
      screenAnchor,
      worldConnectorStart: connectorStart,
      worldConnectorEnd: connectorEnd,
      screenConnectorStart: screenAnchor,
      screenConnectorEnd: context.worldToScreen(connectorEnd),
      lines: visibleLines.map(line => {
        const screen = context.worldToScreen({ x: line.x, y: line.y })
        return {
          ...line,
          x: screen.x,
          y: screen.y,
          width: line.width * context.getViewport().scale,
          widthLimit: line.widthLimit * context.getViewport().scale,
          height: line.height * context.getViewport().scale,
        }
      }),
      fontFamily: LABEL_FONT_FAMILY,
      fontSize: LABEL_FONT_SIZE * context.getViewport().scale,
      fontWeight: LABEL_FONT_WEIGHT,
      lineHeight: LABEL_LINE_HEIGHT * context.getViewport().scale,
      clipped,
    }
  }

  resolveBounds(context: ModelerExternalLabelResolveContext, element: ModelerElement): ModelerRect | null {
    return this.resolve(context, element)?.worldRect ?? null
  }

  hitTest(context: ModelerExternalLabelResolveContext, element: ModelerElement, worldPoint: ModelerPoint): boolean {
    const layout = this.resolve(context, element)
    if (!layout || (!layout.text && !this.isSelected(element.id) && !element.data?.label)) return false
    return containsRect(layout.worldRect, worldPoint)
  }

  createGeometry(context: ModelerExternalLabelResolveContext, element: ModelerElement, rect?: ModelerRect): ModelerExternalLabelGeometry | null {
    const adapter = context.getElementRegistry().get(element.type)?.externalLabel
    if (!adapter) return null
    const anchor = adapter.getAnchorPoint(context, element)
    const source = rect ?? this.resolve(context, element)?.worldRect ?? adapter.getDefaultRect(context, element)
    return normalizeGeometry({
      offsetX: source.x - anchor.x,
      offsetY: source.y - anchor.y,
      width: source.width,
      height: source.height,
    })
  }

  moveGeometry(geometry: ModelerExternalLabelGeometry, dx: number, dy: number): ModelerExternalLabelGeometry {
    return {
      ...geometry,
      offsetX: geometry.offsetX + dx,
      offsetY: geometry.offsetY + dy,
    }
  }

  resizeGeometry(geometry: ModelerExternalLabelGeometry, handle: string, dx: number, dy: number): ModelerExternalLabelGeometry {
    let { offsetX, offsetY, width, height } = geometry
    if (handle.includes('w')) {
      offsetX += dx
      width -= dx
    }
    if (handle.includes('e')) width += dx
    if (handle.includes('n')) {
      offsetY += dy
      height -= dy
    }
    if (handle.includes('s')) height += dy
    if (width < LABEL_MIN_WIDTH) {
      if (handle.includes('w')) offsetX -= LABEL_MIN_WIDTH - width
      width = LABEL_MIN_WIDTH
    }
    if (height < LABEL_MIN_HEIGHT) {
      if (handle.includes('n')) offsetY -= LABEL_MIN_HEIGHT - height
      height = LABEL_MIN_HEIGHT
    }
    return { offsetX, offsetY, width, height }
  }

  getSelected(): ModelerExternalLabelSelectedPart | null {
    return this.selected ? { ...this.selected } : null
  }

  select(elementId: string | null): void {
    const next = elementId ? { elementId, partId: 'label' as const } : null
    if (this.selected?.elementId === next?.elementId && this.selected?.partId === next?.partId) return
    this.selected = next
    this.emit()
  }

  clearSelection(): void {
    this.select(null)
  }

  isSelected(elementId: string): boolean {
    return this.selected?.elementId === elementId
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private resolveGeometry(_context: ModelerExternalLabelResolveContext, element: ModelerElement): ModelerExternalLabelGeometry | null {
    return normalizeGeometry(element.data?.label)
  }

  private createLines(text: string, rect: ModelerRect): Array<ModelerExternalLabelLine> {
    if (!text) return []
    const words = text.split(/\s+/).filter(Boolean)
    const lines: Array<ModelerExternalLabelLine> = []
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (current && measureText(next) > rect.width) {
        lines.push(this.createLine(current, rect, lines.length))
        current = word
        if (lines.length >= LABEL_MAX_AUTO_LINES + 4) break
        continue
      }
      current = next
    }
    if (current) lines.push(this.createLine(current, rect, lines.length))
    if (lines.length === 0) lines.push(this.createLine(text, rect, 0))
    return lines
  }

  private createLine(text: string, rect: ModelerRect, index: number): ModelerExternalLabelLine {
    return {
      text,
      x: rect.x,
      y: rect.y + index * LABEL_LINE_HEIGHT,
      width: measureText(text),
      widthLimit: rect.width,
      height: LABEL_LINE_HEIGHT,
    }
  }

  private worldRectToScreen(context: ModelerExternalLabelResolveContext, rect: ModelerRect): ModelerRect {
    const topLeft = context.worldToScreen({ x: rect.x, y: rect.y })
    const viewport = context.getViewport()
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: rect.width * viewport.scale,
      height: rect.height * viewport.scale,
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

function normalizeGeometry(value: unknown): ModelerExternalLabelGeometry | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Partial<ModelerExternalLabelGeometry>
  const offsetX = finite(input.offsetX)
  const offsetY = finite(input.offsetY)
  const width = finite(input.width)
  const height = finite(input.height)
  if (offsetX === null || offsetY === null || width === null || height === null) return null
  return {
    offsetX,
    offsetY,
    width: Math.max(LABEL_MIN_WIDTH, width),
    height: Math.max(LABEL_MIN_HEIGHT, height),
  }
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeLabelText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function containsRect(rect: ModelerRect, point: ModelerPoint): boolean {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height
}

function nearestRectPoint(rect: ModelerRect, point: ModelerPoint): ModelerPoint {
  return {
    x: Math.max(rect.x, Math.min(rect.x + rect.width, point.x)),
    y: Math.max(rect.y, Math.min(rect.y + rect.height, point.y)),
  }
}

function measureText(text: string): number {
  return text.length * LABEL_FONT_SIZE * 0.58
}

function fitTextWithEllipsis(text: string, width: number): string {
  if (measureText(text) <= width) return text
  let next = text
  while (next.length > 0 && measureText(`${next}${LABEL_ELLIPSIS}`) > width) {
    next = next.slice(0, -1).trimEnd()
  }
  return next ? `${next}${LABEL_ELLIPSIS}` : LABEL_ELLIPSIS
}
