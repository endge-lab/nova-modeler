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
import { normalizeBpmnTextAnnotationBracketSide } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.factory'
import type { BpmnTextAnnotationElement } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.types'
import { resolveBpmnTaskNameLayout } from '@/ui/elements/bpmn/task/BpmnTaskView'

export interface BpmnTextAnnotationViewProps {
  element: BpmnTextAnnotationElement
  viewport: ModelerViewport
  selected?: boolean
}

export interface BpmnTextAnnotationViewResolvedProps {
  element: BpmnTextAnnotationElement
  viewport: ModelerViewport
  selected: boolean
}

export type BpmnTextAnnotationViewDescriptor = NovaComponentDescriptor<
  BpmnTextAnnotationViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnTextAnnotationViewProps
>

@NovaComponent({
  type: Modeler.BpmnTextAnnotationView,
  name: 'BpmnTextAnnotationView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'selected'],
  },
})
export class BpmnTextAnnotationView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnTextAnnotationViewResolvedProps, Record<string, never>, Record<string, never>, BpmnTextAnnotationViewProps, E> {
  @Prop.object<BpmnTextAnnotationElement>({ required: true })
  declare element: BpmnTextAnnotationElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnTextAnnotationViewDescriptor,
    props: BpmnTextAnnotationViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnTextAnnotationViewProps): BpmnTextAnnotationViewResolvedProps {
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
    this.renderer.schema(this.createSchema())
  }

  private createSchema(): NovaSchema {
    const schema: NovaSchema = []
    const style = this.props.element.style ?? {}
    const stroke = this.props.selected
      ? String(style.selectedStroke ?? this.resolveThemeColor('elementSelectedStroke'))
      : String(style.stroke ?? this.resolveThemeColor('elementStroke'))
    const strokeWidth = this.resolveStyleNumber(style.strokeWidth, 'elementStrokeWidth')
    const opacity = this.resolveStyleNumber(style.opacity, 'elementOpacity')
    const side = normalizeBpmnTextAnnotationBracketSide(this.props.element.data?.bracketSide)
    const x = side === 'left' ? -this.width / 2 : this.width / 2
    const innerX = side === 'left' ? x + 14 : x - 14
    const top = -this.height / 2
    const bottom = this.height / 2
    schema.push({ type: 'line', x1: x, y1: top, x2: x, y2: bottom, styles: { color: stroke, width: strokeWidth, opacity } })
    schema.push({ type: 'line', x1: x, y1: top, x2: innerX, y2: top, styles: { color: stroke, width: strokeWidth, opacity } })
    schema.push({ type: 'line', x1: x, y1: bottom, x2: innerX, y2: bottom, styles: { color: stroke, width: strokeWidth, opacity } })
    this.appendText(schema)
    return schema
  }

  private appendText(schema: NovaSchema): void {
    const side = normalizeBpmnTextAnnotationBracketSide(this.props.element.data?.bracketSide)
    const reserve = 20
    const layout = resolveBpmnTaskNameLayout({
      name: this.props.element.data?.text ?? 'Text annotation',
      width: Math.max(1, this.width - reserve),
      height: this.height,
      data: {
        taskType: 'none',
        loopType: 'none',
        isForCompensation: false,
      },
    })
    const offsetX = side === 'left' ? reserve / 2 : -reserve / 2
    const color = this.resolveThemeColor('bpmnTaskTextColor')
    for (const line of layout.lines) {
      schema.push({
        type: 'text',
        text: line.text,
        x: line.x + offsetX,
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
          align: { horizontal: 'left', vertical: 'top' },
          ellipsis: false,
        },
      })
    }
  }

  private resolveStyleNumber(value: unknown, token: ModelerThemeTokenKey): number {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : this.resolveThemeNumber(token)
  }

  private resolveThemeColor(token: ModelerThemeTokenKey): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }

  private resolveThemeNumber(token: ModelerThemeTokenKey): number {
    const fallback = Number(MODELER_THEME_FALLBACKS[token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
}

export const MODELER_BPMN_TEXT_ANNOTATION_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnTextAnnotationViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnTextAnnotationViewProps
>(BpmnTextAnnotationView as never) as BpmnTextAnnotationViewDescriptor
