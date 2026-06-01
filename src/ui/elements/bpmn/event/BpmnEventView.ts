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
import type { ModelerViewport } from '@/domain/types'
import type {
  BpmnEventDirection,
  BpmnEventElement,
  BpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.types'

export interface BpmnEventViewProps {
  element: BpmnEventElement
  viewport: ModelerViewport
  selected?: boolean
}

export interface BpmnEventViewResolvedProps {
  element: BpmnEventElement
  viewport: ModelerViewport
  selected: boolean
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
    render: ['element', 'selected'],
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
    this.renderer.schema(this.createEventSchema())
  }

  private createEventSchema(): NovaSchema {
    const element = this.props.element
    const data = element.data ?? { eventPosition: 'start', trigger: 'none' }
    const style = element.style ?? {}
    const radius = Math.max(0, Math.min(this.width, this.height) / 2)
    const stroke = String(this.props.selected
      ? style.selectedStroke ?? this.resolveThemeColor('bpmnEventSelectedStroke', 'elementSelectedStroke')
      : style.stroke ?? this.resolveThemeColor('bpmnEventStroke', 'elementStroke'))
    const fill = String(style.fill ?? this.resolveThemeColor('bpmnEventFill', 'elementFill'))
    const strokeWidth = this.resolveStyleNumber(style.strokeWidth, 'bpmnEventStrokeWidth', 'elementStrokeWidth')
    const endStrokeWidth = this.resolveStyleNumber(style.endStrokeWidth, 'bpmnEventEndStrokeWidth')
    const schema: NovaSchema = []

    if (data.eventPosition === 'intermediate') {
      schema.push(this.createCircle(radius, fill, stroke, strokeWidth))
      schema.push(this.createCircle(Math.max(0, radius - this.resolveIntermediateGap()), 'rgba(0,0,0,0)', stroke, strokeWidth))
      this.appendTriggerMarker(schema)
      return schema
    }

    schema.push(this.createCircle(
      radius,
      fill,
      stroke,
      data.eventPosition === 'end' ? Math.max(endStrokeWidth, strokeWidth) : strokeWidth,
    ))
    this.appendTriggerMarker(schema)
    return schema
  }

  private appendTriggerMarker(schema: NovaSchema): void {
    const data = this.props.element.data ?? { eventPosition: 'start' as const, trigger: 'none' as const }
    const trigger = data.trigger ?? 'none'
    if (trigger === 'none') return
    const position = data.eventPosition ?? 'start'
    const direction = data.direction ?? (position === 'end' ? 'throw' : 'catch')
    const markerColor = String(this.props.element.style?.markerColor ?? this.resolveThemeColor('bpmnEventStroke', 'elementStroke'))
    const size = Math.max(12, Math.min(this.width, this.height) * 0.48)
    const filled = trigger === 'terminate' || direction === 'throw'
    this.appendMarkerByTrigger(schema, trigger, direction, size, markerColor, filled)
  }

  private appendMarkerByTrigger(
    schema: NovaSchema,
    trigger: BpmnEventTrigger,
    direction: BpmnEventDirection,
    size: number,
    color: string,
    filled: boolean,
  ): void {
    if (trigger === 'message') {
      this.appendMessageMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'timer') {
      this.appendTimerMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'error') {
      this.appendErrorMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'escalation' || trigger === 'signal') {
      this.appendTriangleMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'cancel') {
      this.appendCancelMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'compensation') {
      this.appendCompensationMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'conditional') {
      this.appendConditionalMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'link') {
      this.appendLinkMarker(schema, size, color, filled)
      return
    }
    if (trigger === 'terminate') {
      this.appendCircleMarker(schema, size * 0.34, color, true)
      return
    }
    if (trigger === 'parallelMultiple') {
      this.appendParallelMultipleMarker(schema, size, color, filled)
      return
    }
    this.appendMultipleMarker(schema, size, color, filled || direction === 'throw')
  }

  private appendMessageMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const w = size * 0.78
    const h = size * 0.48
    const x = -w / 2
    const y = -h / 2
    this.appendRectMarker(schema, x, y, w, h, color, filled)
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: x, y1: y, x2: 0, y2: y + h * 0.56, styles: { color: lineColor, width: 1.6 } })
    schema.push({ type: 'line', x1: x + w, y1: y, x2: 0, y2: y + h * 0.56, styles: { color: lineColor, width: 1.6 } })
  }

  private appendTimerMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const radius = size * 0.32
    this.appendCircleMarker(schema, radius, color, filled)
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: 0, y1: 0, x2: 0, y2: -radius * 0.55, styles: { color: lineColor, width: 1.6 } })
    schema.push({ type: 'line', x1: 0, y1: 0, x2: radius * 0.42, y2: radius * 0.2, styles: { color: lineColor, width: 1.6 } })
  }

  private appendErrorMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    this.appendPolygonMarker(schema, [
      { x: -size * 0.12, y: -size * 0.42 },
      { x: size * 0.2, y: -size * 0.06 },
      { x: size * 0.04, y: -size * 0.06 },
      { x: size * 0.22, y: size * 0.42 },
      { x: -size * 0.22, y: size * 0.02 },
      { x: -size * 0.04, y: size * 0.02 },
    ], color, filled)
  }

  private appendTriangleMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    this.appendPolygonMarker(schema, [
      { x: 0, y: -size * 0.4 },
      { x: size * 0.4, y: size * 0.32 },
      { x: -size * 0.4, y: size * 0.32 },
    ], color, filled)
  }

  private appendCancelMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const lineWidth = filled ? 2.4 : 2
    if (filled) this.appendCircleMarker(schema, size * 0.36, color, true)
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: -size * 0.24, y1: -size * 0.24, x2: size * 0.24, y2: size * 0.24, styles: { color: lineColor, width: lineWidth } })
    schema.push({ type: 'line', x1: size * 0.24, y1: -size * 0.24, x2: -size * 0.24, y2: size * 0.24, styles: { color: lineColor, width: lineWidth } })
  }

  private appendCompensationMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const pointsA = [
      { x: -size * 0.38, y: 0 },
      { x: -size * 0.04, y: -size * 0.3 },
      { x: -size * 0.04, y: size * 0.3 },
    ]
    const pointsB = pointsA.map(point => ({ x: point.x + size * 0.34, y: point.y }))
    this.appendPolygonMarker(schema, pointsA, color, filled)
    this.appendPolygonMarker(schema, pointsB, color, filled)
  }

  private appendConditionalMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const w = size * 0.58
    const h = size * 0.7
    const x = -w / 2
    const y = -h / 2
    this.appendRectMarker(schema, x, y, w, h, color, filled)
    const lineColor = filled ? '#ffffff' : color
    for (let index = 0; index < 3; index += 1) {
      const lineY = y + h * (0.28 + index * 0.22)
      schema.push({ type: 'line', x1: x + w * 0.22, y1: lineY, x2: x + w * 0.78, y2: lineY, styles: { color: lineColor, width: 1.4 } })
    }
  }

  private appendLinkMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    this.appendPolygonMarker(schema, [
      { x: -size * 0.42, y: -size * 0.22 },
      { x: size * 0.06, y: -size * 0.22 },
      { x: size * 0.06, y: -size * 0.38 },
      { x: size * 0.42, y: 0 },
      { x: size * 0.06, y: size * 0.38 },
      { x: size * 0.06, y: size * 0.22 },
      { x: -size * 0.42, y: size * 0.22 },
    ], color, filled)
  }

  private appendParallelMultipleMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    if (filled) this.appendCircleMarker(schema, size * 0.36, color, true)
    const lineColor = filled ? '#ffffff' : color
    const width = filled ? 2.4 : 2
    schema.push({ type: 'line', x1: -size * 0.3, y1: 0, x2: size * 0.3, y2: 0, styles: { color: lineColor, width } })
    schema.push({ type: 'line', x1: 0, y1: -size * 0.3, x2: 0, y2: size * 0.3, styles: { color: lineColor, width } })
  }

  private appendMultipleMarker(schema: NovaSchema, size: number, color: string, filled: boolean): void {
    const points = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / 5)
      return {
        x: Math.cos(angle) * size * 0.36,
        y: Math.sin(angle) * size * 0.36,
      }
    })
    this.appendPolygonMarker(schema, points, color, filled)
  }

  private appendCircleMarker(schema: NovaSchema, radius: number, color: string, filled: boolean): void {
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

  private appendRectMarker(schema: NovaSchema, x: number, y: number, width: number, height: number, color: string, filled: boolean): void {
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

  private appendPolygonMarker(schema: NovaSchema, points: Array<{ x: number; y: number }>, color: string, filled: boolean): void {
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

  private createCircle(radius: number, fill: string, stroke: string, strokeWidth: number): NovaSchema[number] {
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
        },
        opacity: this.resolveStyleNumber(this.props.element.style?.opacity, 'elementOpacity'),
      },
    }
  }

  private resolveIntermediateGap(): number {
    return Math.max(2, this.resolveThemeNumber('bpmnEventIntermediateGap') * this.props.viewport.scale)
  }

  private resolveStyleNumber(value: unknown, token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): number {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : this.resolveThemeNumber(token, fallbackToken)
  }

  private resolveThemeColor(token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): string {
    const fallback = fallbackToken
      ? String(this.resolveThemeValue(fallbackToken))
      : String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }

  private resolveThemeNumber(token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): number {
    const fallback = fallbackToken
      ? this.resolveThemeNumber(fallbackToken)
      : Number(MODELER_THEME_FALLBACKS[token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }

  private resolveThemeValue(token: ModelerThemeTokenKey): string | number {
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
