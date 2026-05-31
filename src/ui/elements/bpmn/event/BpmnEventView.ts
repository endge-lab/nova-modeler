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
import type { BpmnEventElement } from '@/elements/bpmn/event/bpmn-event.types'

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
      return schema
    }

    schema.push(this.createCircle(
      radius,
      fill,
      stroke,
      data.eventPosition === 'end' ? Math.max(endStrokeWidth, strokeWidth) : strokeWidth,
    ))
    return schema
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
