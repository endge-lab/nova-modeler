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
  BpmnGatewayElement,
  BpmnGatewayElementData,
} from '@/elements/bpmn/gateway/bpmn-gateway.types'
import { resolveBpmnGatewayNameLayout } from '@/elements/bpmn/gateway/bpmn-gateway.label'

export interface BpmnGatewayViewProps {
  element: BpmnGatewayElement
  viewport: ModelerViewport
  selected?: boolean
  hideName?: boolean
}

export interface BpmnGatewayViewResolvedProps {
  element: BpmnGatewayElement
  viewport: ModelerViewport
  selected: boolean
  hideName: boolean
}

export type BpmnGatewayViewDescriptor = NovaComponentDescriptor<
  BpmnGatewayViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnGatewayViewProps
>

const DEFAULT_GATEWAY_DATA: BpmnGatewayElementData = {
  name: '',
  gatewayType: 'exclusive',
}

@NovaComponent({
  type: Modeler.BpmnGatewayView,
  name: 'BpmnGatewayView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'viewport', 'selected', 'hideName'],
  },
})
export class BpmnGatewayView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnGatewayViewResolvedProps, Record<string, never>, Record<string, never>, BpmnGatewayViewProps, E> {
  @Prop.object<BpmnGatewayElement>({ required: true })
  declare element: BpmnGatewayElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnGatewayViewDescriptor,
    props: BpmnGatewayViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnGatewayViewProps): BpmnGatewayViewResolvedProps {
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
    this.renderer.schema(this.createGatewaySchema())
  }

  private createGatewaySchema(): NovaSchema {
    const style = this.props.element.style ?? {}
    const stroke = String(this.props.selected
      ? style.selectedStroke ?? this.resolveThemeColor('bpmnGatewaySelectedStroke', 'elementSelectedStroke')
      : style.stroke ?? this.resolveThemeColor('bpmnGatewayStroke', 'elementStroke'))
    const fill = String(style.fill ?? this.resolveThemeColor('bpmnGatewayFill', 'elementFill'))
    const strokeWidth = Number(style.strokeWidth ?? this.resolveThemeNumber('bpmnGatewayStrokeWidth', 'elementStrokeWidth'))
    const opacity = Number(style.opacity ?? this.resolveThemeNumber('elementOpacity'))
    const schema: NovaSchema = [{
      type: 'polygon',
      points: [
        { x: 0, y: -this.height / 2 },
        { x: this.width / 2, y: 0 },
        { x: 0, y: this.height / 2 },
        { x: -this.width / 2, y: 0 },
      ],
      styles: {
        background: fill,
        stroke,
        lineWidth: strokeWidth,
        opacity,
      },
    }]

    this.appendGatewayMarker(schema)
    if (!this.props.hideName) this.appendGatewayName(schema)
    return schema
  }

  private appendGatewayName(schema: NovaSchema): void {
    const layout = resolveBpmnGatewayNameLayout({
      name: this.props.element.data?.name,
      width: this.width,
      height: this.height,
    })
    if (!layout.text) return
    const color = this.resolveThemeColor('bpmnTaskTextColor')
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

  private appendGatewayMarker(schema: NovaSchema): void {
    const data = this.resolveGatewayData()
    if (data.gatewayType === 'parallel') {
      this.appendPlusMarker(schema, 0, 0, Math.min(this.width, this.height) * 0.27)
      return
    }
    if (data.gatewayType === 'inclusive') {
      this.appendCircleMarker(schema, 0, 0, Math.min(this.width, this.height) * 0.2)
      return
    }
    if (data.gatewayType === 'complex') {
      this.appendAsteriskMarker(schema, 0, 0, Math.min(this.width, this.height) * 0.24)
      return
    }
    if (data.gatewayType === 'eventBased') {
      this.appendEventBasedMarker(schema, false)
      return
    }
    if (data.gatewayType === 'parallelEventBased') {
      this.appendEventBasedMarker(schema, true)
      return
    }
    this.appendXMarker(schema, 0, 0, Math.min(this.width, this.height) * 0.18)
  }

  private appendXMarker(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this.resolveThemeColor('bpmnGatewayMarkerStroke')
    const width = this.resolveThemeNumber('bpmnGatewayMarkerStrokeWidth')
    schema.push({ type: 'line', x1: x - size, y1: y - size, x2: x + size, y2: y + size, styles: { color, width } })
    schema.push({ type: 'line', x1: x - size, y1: y + size, x2: x + size, y2: y - size, styles: { color, width } })
  }

  private appendPlusMarker(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this.resolveThemeColor('bpmnGatewayMarkerStroke')
    const width = this.resolveThemeNumber('bpmnGatewayMarkerStrokeWidth')
    schema.push({ type: 'line', x1: x, y1: y - size, x2: x, y2: y + size, styles: { color, width } })
    schema.push({ type: 'line', x1: x - size, y1: y, x2: x + size, y2: y, styles: { color, width } })
  }

  private appendCircleMarker(schema: NovaSchema, x: number, y: number, radius: number): void {
    const color = this.resolveThemeColor('bpmnGatewayMarkerStroke')
    schema.push({
      type: 'circle',
      x,
      y,
      radius,
      styles: {
        background: 'rgba(0,0,0,0)',
        border: { color, width: this.resolveThemeNumber('bpmnGatewayMarkerStrokeWidth') },
      },
    })
  }

  private appendAsteriskMarker(schema: NovaSchema, x: number, y: number, size: number): void {
    this.appendPlusMarker(schema, x, y, size)
    const color = this.resolveThemeColor('bpmnGatewayMarkerStroke')
    const width = this.resolveThemeNumber('bpmnGatewayMarkerStrokeWidth')
    const diagonal = size * 0.78
    schema.push({ type: 'line', x1: x - diagonal, y1: y - diagonal, x2: x + diagonal, y2: y + diagonal, styles: { color, width } })
    schema.push({ type: 'line', x1: x - diagonal, y1: y + diagonal, x2: x + diagonal, y2: y - diagonal, styles: { color, width } })
  }

  private appendEventBasedMarker(schema: NovaSchema, parallel: boolean): void {
    const size = Math.min(this.width, this.height)
    const radius = size * 0.21
    this.appendCircleMarker(schema, 0, 0, radius)
    this.appendPentagonMarker(schema, 0, 0, radius * 0.72)
    if (parallel) this.appendPlusMarker(schema, 0, 0, radius * 0.45)
  }

  private appendPentagonMarker(schema: NovaSchema, x: number, y: number, radius: number): void {
    const color = this.resolveThemeColor('bpmnGatewayMarkerStroke')
    const points = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5
      return {
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
      }
    })
    schema.push({
      type: 'polygon',
      points,
      styles: {
        background: 'rgba(0,0,0,0)',
        stroke: color,
        lineWidth: this.resolveThemeNumber('bpmnGatewayMarkerStrokeWidth') * 0.8,
      },
    })
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

  private resolveGatewayData(): BpmnGatewayElementData {
    return this.props.element.data ?? DEFAULT_GATEWAY_DATA
  }
}

export const MODELER_BPMN_GATEWAY_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnGatewayViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnGatewayViewProps
>(BpmnGatewayView as never) as BpmnGatewayViewDescriptor
