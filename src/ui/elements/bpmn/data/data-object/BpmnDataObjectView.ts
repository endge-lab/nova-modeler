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
import { normalizeBpmnDataObjectType } from '@/elements/bpmn/data/data-object/bpmn-data-object.factory'
import type { BpmnDataObjectElement } from '@/elements/bpmn/data/data-object/bpmn-data-object.types'
import { resolveBpmnTaskNameLayout } from '@/ui/elements/bpmn/task/BpmnTaskView'

export interface BpmnDataObjectViewProps {
  element: BpmnDataObjectElement
  viewport: ModelerViewport
  selected?: boolean
}

export interface BpmnDataObjectViewResolvedProps {
  element: BpmnDataObjectElement
  viewport: ModelerViewport
  selected: boolean
}

export type BpmnDataObjectViewDescriptor = NovaComponentDescriptor<
  BpmnDataObjectViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnDataObjectViewProps
>

@NovaComponent({
  type: Modeler.BpmnDataObjectView,
  name: 'BpmnDataObjectView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'viewport', 'selected'],
  },
})
export class BpmnDataObjectView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnDataObjectViewResolvedProps, Record<string, never>, Record<string, never>, BpmnDataObjectViewProps, E> {
  @Prop.object<BpmnDataObjectElement>({ required: true })
  declare element: BpmnDataObjectElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnDataObjectViewDescriptor,
    props: BpmnDataObjectViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnDataObjectViewProps): BpmnDataObjectViewResolvedProps {
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
    const style = this.props.element.style ?? {}
    const stroke = this.props.selected
      ? String(style.selectedStroke ?? this.resolveThemeColor('elementSelectedStroke'))
      : String(style.stroke ?? this.resolveThemeColor('elementStroke'))
    const fill = String(style.fill ?? this.resolveThemeColor('elementFill'))
    const strokeWidth = this.resolveStyleNumber(style.strokeWidth, 'elementStrokeWidth')
    const opacity = this.resolveStyleNumber(style.opacity, 'elementOpacity')
    const fold = Math.max(1, Math.min(20, this.width * 0.22))
    const left = -this.width / 2
    const top = -this.height / 2
    const right = this.width / 2
    const schema: NovaSchema = [{
      type: 'polygon',
      points: [
        { x: left, y: top },
        { x: right - fold, y: top },
        { x: right, y: top + fold },
        { x: right, y: this.height / 2 },
        { x: left, y: this.height / 2 },
      ],
      styles: {
        background: fill,
        stroke,
        lineWidth: strokeWidth,
        opacity,
      },
    }]
    schema.push({
      type: 'polygon',
      points: [
        { x: right - fold, y: top },
        { x: right - fold, y: top + fold },
        { x: right, y: top + fold },
      ],
      styles: {
        background: 'rgba(0,0,0,0)',
        stroke,
        lineWidth: strokeWidth,
        opacity,
      },
    })
    this.appendDataDirectionMarker(schema, stroke, strokeWidth, opacity)
    this.appendLabel(schema)
    this.appendCollectionMarker(schema, stroke, opacity)
    return schema
  }

  private appendDataDirectionMarker(schema: NovaSchema, color: string, width: number, opacity: number): void {
    const type = normalizeBpmnDataObjectType(this.props.element.data?.dataObjectType)
    if (type === 'object') return
    const left = -this.width / 2
    const y = -this.height / 2 + this.height * 0.183
    const start = left + this.width * 0.135
    const end = left + this.width * 0.323
    const arrow = Math.max(1, this.height * 0.042)
    if (type === 'input') {
      schema.push({ type: 'line', x1: start, y1: y, x2: end, y2: y, styles: { color, width, opacity } })
      schema.push({ type: 'line', x1: end, y1: y, x2: end - arrow * 1.2, y2: y - arrow, styles: { color, width, opacity } })
      schema.push({ type: 'line', x1: end, y1: y, x2: end - arrow * 1.2, y2: y + arrow, styles: { color, width, opacity } })
      return
    }
    schema.push({ type: 'line', x1: end, y1: y, x2: start, y2: y, styles: { color, width, opacity } })
    schema.push({ type: 'line', x1: start, y1: y, x2: start + arrow * 1.2, y2: y - arrow, styles: { color, width, opacity } })
    schema.push({ type: 'line', x1: start, y1: y, x2: start + arrow * 1.2, y2: y + arrow, styles: { color, width, opacity } })
  }

  private appendLabel(schema: NovaSchema): void {
    const layout = resolveBpmnTaskNameLayout({
      name: this.props.element.data?.name ?? 'Data object',
      width: this.width,
      height: this.height - 18,
      data: {
        taskType: 'none',
        loopType: this.props.element.data?.isCollection ? 'multiInstanceParallel' : 'none',
        isForCompensation: false,
      },
    })
    const color = this.resolveThemeColor('bpmnTaskTextColor')
    for (const line of layout.lines) {
      schema.push({
        type: 'text',
        text: line.text,
        x: line.x,
        y: line.y + 8,
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

  private appendCollectionMarker(schema: NovaSchema, color: string, opacity: number): void {
    if (!this.props.element.data?.isCollection) return
    const markerGap = Math.max(1, this.width * 0.083)
    const markerHeight = Math.max(1, this.height * 0.083)
    const x = -markerGap
    const y = this.height / 2 - this.height * 0.125
    for (let index = 0; index < 3; index += 1) {
      schema.push({
        type: 'line',
        x1: x + index * markerGap,
        y1: y,
        x2: x + index * markerGap,
        y2: y + markerHeight,
        styles: { color, width: 1.6 * this.props.viewport.scale, opacity },
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

export const MODELER_BPMN_DATA_OBJECT_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnDataObjectViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnDataObjectViewProps
>(BpmnDataObjectView as never) as BpmnDataObjectViewDescriptor
