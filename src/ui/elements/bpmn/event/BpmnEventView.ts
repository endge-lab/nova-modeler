import type { NovaApp, NovaComponentDescriptor, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import type { ModelerThemeTokenKey } from '@/config/theme.config'
import type { ModelerViewport } from '@/domain/types'
import type {
  BpmnEventDirection,
  BpmnEventElement,
  BpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.types'
import {
  createNovaDecoratedComponentDescriptor,

  NovaComponent,

  NovaComponentNode,

  Prop,
} from '@endge/nova'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,

} from '@/config/theme.config'
import { resolveBpmnEventNameLayout } from '@/elements/bpmn/event/bpmn-event.label'

export interface BpmnEventViewProps {
  element: BpmnEventElement
  viewport: ModelerViewport
  selected?: boolean
  hideName?: boolean
}

export interface BpmnEventViewResolvedProps {
  element: BpmnEventElement
  viewport: ModelerViewport
  selected: boolean
  hideName: boolean
}

export type BpmnEventViewDescriptor = NovaComponentDescriptor<
  BpmnEventViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnEventViewProps
>

@NovaComponent({
  type: Modeler.BpmnEventView,
  name: 'BpmnEventView',
  version: '0.25.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'viewport', 'selected', 'hideName'],
  },
})
export class BpmnEventView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnEventViewResolvedProps, Record<string, never>, Record<string, never>, BpmnEventViewProps, E> {
  @Prop.object<BpmnEventElement>({ required: true })
  declare element: BpmnEventElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnEventViewDescriptor,
    props: BpmnEventViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnEventViewProps): BpmnEventViewResolvedProps {
    return {
      element: props.element,
      viewport: props.viewport,
      selected: props.selected ?? false,
      hideName: props.hideName ?? false,
    }
  }

  update(): void {
    super.update()
    const element = this.props.element
    const viewport = this.props.viewport
    const scale = viewport.scale
    this.options({
      x: (element.x + element.width / 2) * scale + viewport.x,
      y: (element.y + element.height / 2) * scale + viewport.y,
      width: element.width * scale,
      height: element.height * scale,
      rotation: element.rotation ?? 0,
      interactive: false,
    })
  }

  render(): void {
    super.render()
    this.renderer.schema(this._createEventSchema())
  }

  private _createEventSchema(): NovaSchema {
    const element = this.props.element
    const data = element.data ?? { eventPosition: 'start', trigger: 'none' }
    const style = element.style ?? {}
    const radius = Math.max(0, Math.min(this.width, this.height) / 2)
    const stroke = String(this.props.selected
      ? style.selectedStroke ?? this._resolveThemeColor('bpmnEventSelectedStroke', 'elementSelectedStroke')
      : style.stroke ?? this._resolveThemeColor('bpmnEventStroke', 'elementStroke'))
    const fill = String(style.fill ?? this._resolveThemeColor('bpmnEventFill', 'elementFill'))
    const strokeWidth = this._resolveStyleNumber(style.strokeWidth, 'bpmnEventStrokeWidth', 'elementStrokeWidth')
    const endStrokeWidth = this._resolveStyleNumber(style.endStrokeWidth, 'bpmnEventEndStrokeWidth')
    const schema: NovaSchema = []

    if (data.eventPosition === 'intermediate') {
      schema.push(this._createCircle(radius, fill, stroke, strokeWidth))
      schema.push(this._createCircle(Math.max(0, radius - this._resolveIntermediateGap()), 'rgba(0,0,0,0)', stroke, strokeWidth))
      this._appendTriggerMarker(schema)
      if (!this.props.hideName) {
        this._appendEventName(schema)
      }
      return schema
    }

    schema.push(this._createCircle(
      radius,
      fill,
      stroke,
      data.eventPosition === 'end' ? Math.max(endStrokeWidth, strokeWidth) : strokeWidth,
    ))
    this._appendTriggerMarker(schema)
    if (!this.props.hideName) {
      this._appendEventName(schema)
    }
    return schema
  }

  private _appendEventName(schema: NovaSchema): void {
    const layout = resolveBpmnEventNameLayout({
      name: this.props.element.data?.name,
      width: this.width,
      height: this.height,
    })
    if (!layout.text) {
      return
    }
    const color = this._resolveThemeColor('bpmnTaskTextColor')
    for (const line of layout.lines) {
      schema.push({
        type: 'text',
        text: line.text,
        x: line.x,
        y: line.y,
        width: line.widthLimit,
        height: line.height,
        clip: true,
        styles: {
          color,
          font: {
            family: layout.fontFamily,
            size: layout.fontSize,
            weight: layout.fontWeight,
          },
          lineHeight: layout.lineHeight,
          align: { horizontal: 'center', vertical: 'top' },
          ellipsis: false,
        },
      })
    }
  }

  private _appendTriggerMarker(schema: NovaSchema): void {
    const data = this.props.element.data ?? { eventPosition: 'start' as const, trigger: 'none' as const }
    const trigger = data.trigger ?? 'none'
    if (trigger === 'none') {
      return
    }
    const position = data.eventPosition ?? 'start'
    const direction = data.direction ?? (position === 'end' ? 'throw' : 'catch')
    const markerColor = String(this.props.element.style?.markerColor ?? this._resolveThemeColor('bpmnEventStroke', 'elementStroke'))
    const size = Math.max(1, Math.min(this.width, this.height) * 0.48)
    const filled = trigger === 'terminate' || direction === 'throw'
    this._appendMarkerByTrigger(schema, trigger, direction, size, markerColor, filled)
  }

  private _appendMarkerByTrigger(
    schema: NovaSchema,
    trigger: BpmnEventTrigger,
    direction: BpmnEventDirection,
    size: number,
    color: string,
    filled: boolean,
  ): void {
    if (trigger === 'message') {
      this._appendMessageMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'timer') {
      this._appendTimerMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'error') {
      this._appendErrorMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'escalation' || trigger === 'signal') {
      this._appendTriangleMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'cancel') {
      this._appendCancelMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'compensation') {
      this._appendCompensationMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'conditional') {
      this._appendConditionalMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'link') {
      this._appendLinkMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'terminate') {
      this._appendCircleMarker(schema, size * 0.34, color, true)
      return
    }
    if (trigger === 'parallelMultiple') {
      this._appendParallelMultipleMarker(schema, size, color, filled)
      return
    }
    this._appendMultipleMarker(schema, size, color, filled || direction === 'throw')
  }

  private _appendMessageMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const w = size * 0.78
    const h = size * 0.48
    const x = -w / 2
    const y = -h / 2
    this._appendRectMarker(schema, x, y, w, h, color, filled)
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: x, y1: y, x2: 0, y2: y + h * 0.56, styles: { color: lineColor, width: 1.6 } })
    schema.push({ type: 'line', x1: x + w, y1: y, x2: 0, y2: y + h * 0.56, styles: { color: lineColor, width: 1.6 } })
  }

  private _appendTimerMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const radius = size * 0.32
    this._appendCircleMarker(schema, radius, color, filled)
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: 0, y1: 0, x2: 0, y2: -radius * 0.55, styles: { color: lineColor, width: 1.6 } })
    schema.push({ type: 'line', x1: 0, y1: 0, x2: radius * 0.42, y2: radius * 0.2, styles: { color: lineColor, width: 1.6 } })
  }

  private _appendErrorMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    this._appendPolygonMarker(schema, [
      { x: -size * 0.12, y: -size * 0.42 },
      { x: size * 0.2, y: -size * 0.06 },
      { x: size * 0.04, y: -size * 0.06 },
      { x: size * 0.22, y: size * 0.42 },
      { x: -size * 0.22, y: size * 0.02 },
      { x: -size * 0.04, y: size * 0.02 },
    ], color, filled)
  }

  private _appendTriangleMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    this._appendPolygonMarker(schema, [
      { x: 0, y: -size * 0.4 },
      { x: size * 0.4, y: size * 0.32 },
      { x: -size * 0.4, y: size * 0.32 },
    ], color, filled)
  }

  private _appendCancelMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const lineWidth = filled ? 2.4 : 2
    if (filled) {
      this._appendCircleMarker(schema, size * 0.36, color, true)
    }
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: -size * 0.24, y1: -size * 0.24, x2: size * 0.24, y2: size * 0.24, styles: { color: lineColor, width: lineWidth } })
    schema.push({ type: 'line', x1: size * 0.24, y1: -size * 0.24, x2: -size * 0.24, y2: size * 0.24, styles: { color: lineColor, width: lineWidth } })
  }

  private _appendCompensationMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const pointsA = [
      { x: -size * 0.38, y: 0 },
      { x: -size * 0.04, y: -size * 0.3 },
      { x: -size * 0.04, y: size * 0.3 },
    ]
    const pointsB = pointsA.map(point => ({ x: point.x + size * 0.34, y: point.y }))
    this._appendPolygonMarker(schema, pointsA, color, filled)
    this._appendPolygonMarker(schema, pointsB, color, filled)
  }

  private _appendConditionalMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const w = size * 0.58
    const h = size * 0.7
    const x = -w / 2
    const y = -h / 2
    this._appendRectMarker(schema, x, y, w, h, color, filled)
    const lineColor = filled ? '#ffffff' : color
    for (let index = 0; index < 3; index += 1) {
      const lineY = y + h * (0.28 + index * 0.22)
      schema.push({ type: 'line', x1: x + w * 0.22, y1: lineY, x2: x + w * 0.78, y2: lineY, styles: { color: lineColor, width: 1.4 } })
    }
  }

  private _appendLinkMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    this._appendPolygonMarker(schema, [
      { x: -size * 0.42, y: -size * 0.22 },
      { x: size * 0.06, y: -size * 0.22 },
      { x: size * 0.06, y: -size * 0.38 },
      { x: size * 0.42, y: 0 },
      { x: size * 0.06, y: size * 0.38 },
      { x: size * 0.06, y: size * 0.22 },
      { x: -size * 0.42, y: size * 0.22 },
    ], color, filled)
  }

  private _appendParallelMultipleMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    if (filled) {
      this._appendCircleMarker(schema, size * 0.36, color, true)
    }
    const lineColor = filled ? '#ffffff' : color
    const width = filled ? 2.4 : 2
    schema.push({ type: 'line', x1: -size * 0.3, y1: 0, x2: size * 0.3, y2: 0, styles: { color: lineColor, width } })
    schema.push({ type: 'line', x1: 0, y1: -size * 0.3, x2: 0, y2: size * 0.3, styles: { color: lineColor, width } })
  }

  private _appendMultipleMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const points = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / 5)
      return {
        x: Math.cos(angle) * size * 0.36,
        y: Math.sin(angle) * size * 0.36,
      }
    })
    this._appendPolygonMarker(schema, points, color, filled)
  }

  private _appendCircleMarker(schema: NovaSchema, radius: number, color: string, filled: boolean): void {
    schema.push({
      type: 'circle',
      x: 0,
      y: 0,
      radius,
      styles: {
        background: filled ? color : 'rgba(0,0,0,0)',
        border: {
          color,
          width: 2,
        },
      },
    })
  }

  private _appendRectMarker(schema: NovaSchema, x: number, y: number, width: number, height: number, color: string, filled: boolean): void {
    schema.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      styles: {
        background: filled ? color : 'rgba(0,0,0,0)',
        border: {
          color,
          width: 2,
        },
      },
    })
  }

  private _appendPolygonMarker(schema: NovaSchema, points: Array<{ x: number, y: number }>, color: string, filled: boolean): void {
    schema.push({
      type: 'polygon',
      points,
      styles: {
        background: filled ? color : 'rgba(0,0,0,0)',
        stroke: color,
        lineWidth: 2,
      },
    })
  }

  private _createCircle(radius: number, fill: string, stroke: string, strokeWidth: number): NovaSchema[number] {
    const dashPattern = this.props.element.data?.isInterrupting === false ? [5, 4] as [number, number] : undefined
    return {
      type: 'circle',
      x: 0,
      y: 0,
      radius,
      styles: {
        background: fill,
        border: {
          color: stroke,
          width: strokeWidth,
          dashPattern,
        },
        opacity: this._resolveStyleNumber(this.props.element.style?.opacity, 'elementOpacity'),
      },
    }
  }

  private _resolveIntermediateGap(): number {
    return Math.max(0.5, this._resolveThemeNumber('bpmnEventIntermediateGap') * this.props.viewport.scale)
  }

  private _resolveStyleNumber(value: unknown, token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): number {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : this._resolveThemeNumber(token, fallbackToken)
  }

  private _resolveThemeColor(token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): string {
    const fallback = fallbackToken
      ? String(this._resolveThemeValue(fallbackToken))
      : String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }

  private _resolveThemeNumber(token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): number {
    const fallback = fallbackToken
      ? this._resolveThemeNumber(fallbackToken)
      : Number(MODELER_THEME_FALLBACKS[token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }

  private _resolveThemeValue(token: ModelerThemeTokenKey): string | number {
    const fallback = MODELER_THEME_FALLBACKS[token]
    return this.nova.theme.resolve(
      MODELER_THEME_TOKENS[token],
      String(fallback),
    ) ?? fallback
  }
}

export const MODELER_BPMN_EVENT_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnEventViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnEventViewProps
>(BpmnEventView as never) as BpmnEventViewDescriptor
