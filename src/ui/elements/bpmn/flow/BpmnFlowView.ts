import {
  NovaComponent,
  NovaComponentNode,
  Prop,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaComponentDescriptor,
  type NovaSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
  type ModelerThemeTokenKey,
} from '@/config/theme.config'
import type {
  ModelerPoint,
  ModelerViewport,
} from '@/domain/types/index'
import { normalizeBpmnFlowType } from '@/elements/bpmn/flow/bpmn-flow.factory'
import type { BpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.types'

export interface BpmnFlowViewProps {
  element: BpmnFlowElement
  viewport: ModelerViewport
  path: Array<ModelerPoint>
  selected?: boolean
  preview?: boolean
  hideName?: boolean
}

export interface BpmnFlowViewResolvedProps {
  element: BpmnFlowElement
  viewport: ModelerViewport
  path: Array<ModelerPoint>
  selected: boolean
  preview: boolean
  hideName: boolean
}

export type BpmnFlowViewDescriptor = NovaComponentDescriptor<
  BpmnFlowViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnFlowViewProps
>

@NovaComponent({
  type: Modeler.BpmnFlowView,
  name: 'BpmnFlowView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['viewport'],
    render: ['element', 'viewport', 'path', 'selected', 'preview', 'hideName'],
  },
})
export class BpmnFlowView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnFlowViewResolvedProps, Record<string, never>, Record<string, never>, BpmnFlowViewProps, E> {
  @Prop.object<BpmnFlowElement>({ required: true })
  declare element: BpmnFlowElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  @Prop.array<Array<ModelerPoint>>({ default: () => [] })
  declare path: Array<ModelerPoint>

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnFlowViewDescriptor,
    props: BpmnFlowViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnFlowViewProps): BpmnFlowViewResolvedProps {
    return {
      element: props.element,
      viewport: props.viewport,
      path: props.path ?? [],
      selected: props.selected ?? false,
      preview: props.preview ?? false,
      hideName: props.hideName ?? false,
    }
  }

  update(): void {
    super.update()
    this.options({ width: this.surface.width, height: this.surface.height, interactive: false })
  }

  render(): void {
    super.render()
    this.renderer.schema(this.createSchema())
  }

  private createSchema(): NovaSchema {
    const color = this.resolveStroke()
    const width = this.resolveStrokeWidth()
    const path = this.props.path
      .map(point => this.worldToScreen(point))
      .map(point => this.alignPointToPixel(point, width))
    if (path.length < 2) return []
    const opacity = Number(this.props.element.style?.opacity ?? this.resolveThemeNumber('elementOpacity'))
    const schema: NovaSchema = []
    for (let index = 0; index < path.length - 1; index += 1) {
      const start = path[index]!
      const rawEnd = path[index + 1]!
      const end = index === path.length - 2
        ? this.resolveTargetArrowLineEnd(start, rawEnd)
        : rawEnd
      schema.push({
        type: 'line',
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        styles: { color, width, opacity },
      })
    }
    this.appendSegmentJoins(schema, path, color, width, opacity)
    this.appendTargetArrow(schema, path, color, opacity)
    this.appendSourceMarker(schema, path, color, width, opacity)
    if (!this.props.hideName) this.appendLabel(schema, path, opacity)
    return schema
  }

  private appendLabel(schema: NovaSchema, path: Array<ModelerPoint>, opacity: number): void {
    const layout = resolveBpmnFlowLabelLayout({
      name: this.props.element.data?.name,
      path,
      scale: this.props.viewport.scale,
    })
    if (!layout.text) return
    schema.push({
      type: 'text',
      text: layout.text,
      x: layout.rect.x,
      y: layout.rect.y,
      width: layout.rect.width,
      height: layout.rect.height,
      clip: true,
      styles: {
        color: this.resolveThemeColor('bpmnTaskTextColor'),
        opacity,
        font: {
          family: layout.fontFamily,
          size: layout.fontSize,
          weight: layout.fontWeight,
        },
        lineHeight: layout.lineHeight,
        align: { horizontal: 'center', vertical: 'middle' },
        ellipsis: true,
      },
    })
  }

  private appendSegmentJoins(schema: NovaSchema, path: Array<ModelerPoint>, color: string, width: number, opacity: number): void {
    for (let index = 1; index < path.length - 1; index += 1) {
      const point = path[index]!
      schema.push({
        type: 'circle',
        x: point.x,
        y: point.y,
        radius: width / 2,
        styles: {
          background: color,
          opacity,
        },
      })
    }
  }

  private appendTargetArrow(schema: NovaSchema, path: Array<ModelerPoint>, color: string, opacity: number): void {
    const end = path[path.length - 1]!
    const previous = this.findPreviousDistinctPoint(path, path.length - 2, end)
    if (!previous) return
    const angle = Math.atan2(end.y - previous.y, end.x - previous.x)
    const length = this.resolveTargetArrowLength()
    const spread = Math.PI / 7
    schema.push({
      type: 'polygon',
      points: [
        end,
        {
          x: end.x - Math.cos(angle - spread) * length,
          y: end.y - Math.sin(angle - spread) * length,
        },
        {
          x: end.x - Math.cos(angle + spread) * length,
          y: end.y - Math.sin(angle + spread) * length,
        },
      ],
      styles: {
        background: color,
        stroke: 'rgba(0,0,0,0)',
        lineWidth: 0,
        opacity,
      },
    })
  }

  private resolveTargetArrowLineEnd(start: ModelerPoint, end: ModelerPoint): ModelerPoint {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.hypot(dx, dy)
    if (distance <= 0.001) return end
    const baseOffset = Math.cos(Math.PI / 7) * this.resolveTargetArrowLength()
    if (distance <= baseOffset + 1) return start
    return {
      x: end.x - dx / distance * baseOffset,
      y: end.y - dy / distance * baseOffset,
    }
  }

  private resolveTargetArrowLength(): number {
    return 12 * this.props.viewport.scale
  }

  private appendSourceMarker(schema: NovaSchema, path: Array<ModelerPoint>, color: string, width: number, opacity: number): void {
    const flowType = normalizeBpmnFlowType(this.props.element.data?.flowType)
    if (flowType === 'sequence') return
    const start = path[0]!
    const next = this.findNextDistinctPoint(path, 1, start)
    if (!next) return
    const angle = Math.atan2(next.y - start.y, next.x - start.x)
    if (flowType === 'conditionalSequence') {
      this.appendConditionalMarker(schema, start, angle, color, width, opacity)
      return
    }
    this.appendDefaultMarker(schema, start, angle, color, width, opacity)
  }

  private appendConditionalMarker(schema: NovaSchema, start: ModelerPoint, angle: number, color: string, width: number, opacity: number): void {
    const center = {
      x: start.x + Math.cos(angle) * 10 * this.props.viewport.scale,
      y: start.y + Math.sin(angle) * 10 * this.props.viewport.scale,
    }
    const size = 6 * this.props.viewport.scale
    const normal = angle + Math.PI / 2
    schema.push({
      type: 'polygon',
      points: [
        { x: center.x + Math.cos(angle) * size, y: center.y + Math.sin(angle) * size },
        { x: center.x + Math.cos(normal) * size, y: center.y + Math.sin(normal) * size },
        { x: center.x - Math.cos(angle) * size, y: center.y - Math.sin(angle) * size },
        { x: center.x - Math.cos(normal) * size, y: center.y - Math.sin(normal) * size },
      ],
      styles: {
        background: this.resolveThemeColor('bpmnFlowMarkerFill'),
        stroke: this.resolveThemeColor('bpmnFlowMarkerStroke', color),
        lineWidth: width,
        opacity,
      },
    })
  }

  private appendDefaultMarker(schema: NovaSchema, start: ModelerPoint, angle: number, color: string, width: number, opacity: number): void {
    const center = {
      x: start.x + Math.cos(angle) * 10 * this.props.viewport.scale,
      y: start.y + Math.sin(angle) * 10 * this.props.viewport.scale,
    }
    const normal = angle + Math.PI / 2
    const tangent = angle
    const offset = 6 * this.props.viewport.scale
    const length = 4 * this.props.viewport.scale
    schema.push({
      type: 'line',
      x1: center.x - Math.cos(normal) * offset - Math.cos(tangent) * length,
      y1: center.y - Math.sin(normal) * offset - Math.sin(tangent) * length,
      x2: center.x + Math.cos(normal) * offset + Math.cos(tangent) * length,
      y2: center.y + Math.sin(normal) * offset + Math.sin(tangent) * length,
      styles: { color, width, opacity },
    })
  }

  private findPreviousDistinctPoint(path: Array<ModelerPoint>, from: number, point: ModelerPoint): ModelerPoint | null {
    for (let index = from; index >= 0; index -= 1) {
      const candidate = path[index]!
      if (candidate.x !== point.x || candidate.y !== point.y) return candidate
    }
    return null
  }

  private findNextDistinctPoint(path: Array<ModelerPoint>, from: number, point: ModelerPoint): ModelerPoint | null {
    for (let index = from; index < path.length; index += 1) {
      const candidate = path[index]!
      if (candidate.x !== point.x || candidate.y !== point.y) return candidate
    }
    return null
  }

  private worldToScreen(point: ModelerPoint): ModelerPoint {
    return {
      x: point.x * this.props.viewport.scale + this.props.viewport.x,
      y: point.y * this.props.viewport.scale + this.props.viewport.y,
    }
  }

  private alignPointToPixel(point: ModelerPoint, strokeWidth: number): ModelerPoint {
    return {
      x: this.alignCoordinateToPixel(point.x, strokeWidth),
      y: this.alignCoordinateToPixel(point.y, strokeWidth),
    }
  }

  private alignCoordinateToPixel(value: number, strokeWidth: number): number {
    const roundedWidth = Math.round(strokeWidth)
    if (Math.abs(strokeWidth - roundedWidth) > 0.001) return value
    return roundedWidth % 2 === 0
      ? Math.round(value)
      : Math.round(value) + 0.5
  }

  private resolveStroke(): string {
    const style = this.props.element.style ?? {}
    if (this.props.preview) return String(style.stroke ?? this.resolveThemeColor('bpmnFlowPreviewStroke'))
    if (this.props.selected) return String(style.selectedStroke ?? this.resolveThemeColor('bpmnFlowSelectedStroke'))
    return String(style.stroke ?? this.resolveThemeColor('bpmnFlowStroke'))
  }

  private resolveStrokeWidth(): number {
    const width = Number(this.props.element.style?.strokeWidth ?? this.resolveThemeNumber('bpmnFlowStrokeWidth'))
    const normalized = Number.isFinite(width) && width > 0 ? width : this.resolveThemeNumber('bpmnFlowStrokeWidth')
    return normalized * this.props.viewport.scale
  }

  private resolveThemeColor(token: ModelerThemeTokenKey, fallback?: string): string {
    const defaultFallback = fallback ?? String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], defaultFallback) ?? defaultFallback
  }

  private resolveThemeNumber(token: ModelerThemeTokenKey): number {
    const fallback = Number(MODELER_THEME_FALLBACKS[token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
}

export const MODELER_BPMN_FLOW_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnFlowViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnFlowViewProps
>(BpmnFlowView as never) as BpmnFlowViewDescriptor

export interface BpmnFlowLabelLayout {
  text: string
  rect: { x: number; y: number; width: number; height: number }
  lines: Array<{ text: string; x: number; y: number; width: number; widthLimit: number; height: number }>
  fontFamily: string
  fontSize: number
  fontWeight: '500'
  lineHeight: number
  clipped: boolean
}

export function resolveBpmnFlowLabelLayout(input: {
  name?: string
  path: Array<ModelerPoint>
  scale?: number
}): BpmnFlowLabelLayout {
  const text = typeof input.name === 'string' ? input.name.trim() : ''
  const scale = Math.max(0.01, input.scale ?? 1)
  const fontFamily = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  const fontSize = Math.max(1, 12 * scale)
  const fontWeight = '500' as const
  const lineHeight = Math.max(1, 16 * scale)
  const midpoint = resolvePathMidpoint(input.path) ?? { x: 0, y: 0 }
  const width = Math.min(180 * scale, Math.max(8 * scale, Math.ceil(text.length * fontSize * 0.58) + 18 * scale))
  const height = Math.max(1, 22 * scale)
  const rect = {
    x: midpoint.x - width / 2,
    y: midpoint.y - height / 2 - 10 * scale,
    width,
    height,
  }
  return {
    text,
    rect,
    lines: [{
      text,
      x: rect.x,
      y: rect.y,
      width,
      widthLimit: width,
      height,
    }],
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    clipped: text.length * fontSize * 0.58 > width - 8 * scale,
  }
}

function resolvePathMidpoint(path: Array<ModelerPoint>): ModelerPoint | null {
  if (path.length === 0) return null
  if (path.length === 1) return path[0]!
  let total = 0
  for (let index = 0; index < path.length - 1; index += 1) {
    total += distance(path[index]!, path[index + 1]!)
  }
  if (total <= 0.001) return path[0]!
  const target = total / 2
  let walked = 0
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]!
    const end = path[index + 1]!
    const segment = distance(start, end)
    if (walked + segment >= target) {
      const ratio = segment <= 0.001 ? 0 : (target - walked) / segment
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      }
    }
    walked += segment
  }
  return path[path.length - 1]!
}

function distance(a: ModelerPoint, b: ModelerPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}
