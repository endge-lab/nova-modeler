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
import type { BpmnDataStoreElement } from '@/elements/bpmn/data/data-store/bpmn-data-store.types'
import { resolveBpmnTaskNameLayout } from '@/ui/elements/bpmn/task/BpmnTaskView'

export interface BpmnDataStoreViewProps {
  element: BpmnDataStoreElement
  viewport: ModelerViewport
  selected?: boolean
}

export interface BpmnDataStoreViewResolvedProps {
  element: BpmnDataStoreElement
  viewport: ModelerViewport
  selected: boolean
}

export type BpmnDataStoreViewDescriptor = NovaComponentDescriptor<
  BpmnDataStoreViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnDataStoreViewProps
>

@NovaComponent({
  type: Modeler.BpmnDataStoreView,
  name: 'BpmnDataStoreView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'selected'],
  },
})
export class BpmnDataStoreView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnDataStoreViewResolvedProps, Record<string, never>, Record<string, never>, BpmnDataStoreViewProps, E> {
  @Prop.object<BpmnDataStoreElement>({ required: true })
  declare element: BpmnDataStoreElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnDataStoreViewDescriptor,
    props: BpmnDataStoreViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnDataStoreViewProps): BpmnDataStoreViewResolvedProps {
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
    const schema: NovaSchema = [{
      type: 'rect',
      x: -this.width / 2,
      y: -this.height / 2,
      width: this.width,
      height: this.height,
      styles: {
        background: fill,
        border: {
          color: stroke,
          width: strokeWidth,
          radius: Math.max(16, Math.min(24, this.height * 0.28)),
        },
        opacity,
      },
    }]
    schema.push({ type: 'line', x1: -this.width / 2 + 2, y1: -this.height / 2 + 18, x2: this.width / 2 - 2, y2: -this.height / 2 + 18, styles: { color: stroke, width: strokeWidth, opacity } })
    schema.push({ type: 'line', x1: -this.width / 2 + 2, y1: this.height / 2 - 18, x2: this.width / 2 - 2, y2: this.height / 2 - 18, styles: { color: stroke, width: strokeWidth, opacity } })
    this.appendLabel(schema)
    return schema
  }

  private appendLabel(schema: NovaSchema): void {
    const layout = resolveBpmnTaskNameLayout({
      name: this.props.element.data?.name ?? 'Data store',
      width: this.width,
      height: this.height - 28,
      data: {
        taskType: 'none',
        loopType: 'none',
        isForCompensation: false,
      },
    })
    const color = this.resolveThemeColor('bpmnTaskTextColor')
    for (const line of layout.lines) {
      schema.push({
        type: 'text',
        text: line.text,
        x: line.x,
        y: line.y + 14,
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

export const MODELER_BPMN_DATA_STORE_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnDataStoreViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnDataStoreViewProps
>(BpmnDataStoreView as never) as BpmnDataStoreViewDescriptor
