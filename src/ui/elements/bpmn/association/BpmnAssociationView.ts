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
import { normalizeBpmnAssociationType } from '@/elements/bpmn/association/bpmn-association.factory'
import type { BpmnAssociationElement } from '@/elements/bpmn/association/bpmn-association.types'

export interface BpmnAssociationViewProps {
  element: BpmnAssociationElement
  viewport: ModelerViewport
  path: Array<ModelerPoint>
  selected?: boolean
  preview?: boolean
}

export interface BpmnAssociationViewResolvedProps {
  element: BpmnAssociationElement
  viewport: ModelerViewport
  path: Array<ModelerPoint>
  selected: boolean
  preview: boolean
}

export type BpmnAssociationViewDescriptor = NovaComponentDescriptor<
  BpmnAssociationViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnAssociationViewProps
>

@NovaComponent({
  type: Modeler.BpmnAssociationView,
  name: 'BpmnAssociationView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['viewport'],
    render: ['element', 'viewport', 'path', 'selected', 'preview'],
  },
})
export class BpmnAssociationView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnAssociationViewResolvedProps, Record<string, never>, Record<string, never>, BpmnAssociationViewProps, E> {
  @Prop.object<BpmnAssociationElement>({ required: true })
  declare element: BpmnAssociationElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  @Prop.array<Array<ModelerPoint>>({ default: () => [] })
  declare path: Array<ModelerPoint>

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnAssociationViewDescriptor,
    props: BpmnAssociationViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnAssociationViewProps): BpmnAssociationViewResolvedProps {
    return {
      element: props.element,
      viewport: props.viewport,
      path: props.path ?? [],
      selected: props.selected ?? false,
      preview: props.preview ?? false,
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
      const end = path[index + 1]!
      schema.push({
        type: 'line',
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        styles: { color, width, opacity, dashPattern: [4, 4] },
      })
    }
    this.appendMarkers(schema, path, color, width, opacity)
    return schema
  }

  private appendMarkers(schema: NovaSchema, path: Array<ModelerPoint>, color: string, width: number, opacity: number): void {
    const type = normalizeBpmnAssociationType(this.props.element.data?.associationType)
    if (type === 'undirected') return
    const end = path[path.length - 1]!
    const previous = this.findPreviousDistinctPoint(path, path.length - 2, end)
    if (previous) this.appendOpenArrow(schema, end, previous, color, width, opacity)
    if (type !== 'bidirectional') return
    const start = path[0]!
    const next = this.findNextDistinctPoint(path, 1, start)
    if (next) this.appendOpenArrow(schema, start, next, color, width, opacity)
  }

  private appendOpenArrow(
    schema: NovaSchema,
    point: ModelerPoint,
    previous: ModelerPoint,
    color: string,
    width: number,
    opacity: number,
  ): void {
    const angle = Math.atan2(point.y - previous.y, point.x - previous.x)
    const length = 11 * this.props.viewport.scale
    const spread = Math.PI / 7
    schema.push({
      type: 'line',
      x1: point.x,
      y1: point.y,
      x2: point.x - Math.cos(angle - spread) * length,
      y2: point.y - Math.sin(angle - spread) * length,
      styles: { color, width, opacity },
    })
    schema.push({
      type: 'line',
      x1: point.x,
      y1: point.y,
      x2: point.x - Math.cos(angle + spread) * length,
      y2: point.y - Math.sin(angle + spread) * length,
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

export const MODELER_BPMN_ASSOCIATION_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnAssociationViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnAssociationViewProps
>(BpmnAssociationView as never) as BpmnAssociationViewDescriptor
