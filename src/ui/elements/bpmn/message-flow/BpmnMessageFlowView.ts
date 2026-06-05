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
import type { BpmnMessageFlowElement } from '@/elements/bpmn/message-flow/bpmn-message-flow.types'

export interface BpmnMessageFlowViewProps {
  element: BpmnMessageFlowElement
  viewport: ModelerViewport
  path: Array<ModelerPoint>
  selected?: boolean
  preview?: boolean
}

export interface BpmnMessageFlowViewResolvedProps {
  element: BpmnMessageFlowElement
  viewport: ModelerViewport
  path: Array<ModelerPoint>
  selected: boolean
  preview: boolean
}

export type BpmnMessageFlowViewDescriptor = NovaComponentDescriptor<
  BpmnMessageFlowViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnMessageFlowViewProps
>

@NovaComponent({
  type: Modeler.BpmnMessageFlowView,
  name: 'BpmnMessageFlowView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['viewport'],
    render: ['element', 'path', 'selected', 'preview'],
  },
})
export class BpmnMessageFlowView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnMessageFlowViewResolvedProps, Record<string, never>, Record<string, never>, BpmnMessageFlowViewProps, E> {
  @Prop.object<BpmnMessageFlowElement>({ required: true })
  declare element: BpmnMessageFlowElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  @Prop.array<Array<ModelerPoint>>({ default: () => [] })
  declare path: Array<ModelerPoint>

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnMessageFlowViewDescriptor,
    props: BpmnMessageFlowViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
    this.syncViewportTransform()
  }

  static normalizeProps(props: BpmnMessageFlowViewProps): BpmnMessageFlowViewResolvedProps {
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
    this.syncViewportTransform()
  }

  override setProps(patch: Partial<BpmnMessageFlowViewResolvedProps>): this {
    const changedKeys = (Object.keys(patch) as Array<keyof BpmnMessageFlowViewResolvedProps>)
      .filter(key => patch[key] !== undefined && this.props[key] !== patch[key])
    if (changedKeys.length === 0) return this
    if (changedKeys.every(key => key === 'viewport')) {
      this.props.viewport = patch.viewport ?? this.props.viewport
      this.syncViewportTransform()
      this.notifySyncPortChanged('viewport', this.props.viewport)
      this.dirty({ matrix: true })
      return this
    }
    return super.setProps(patch)
  }

  render(): void {
    super.render()
    this.renderer.schema(this.createSchema())
  }

  private createSchema(): NovaSchema {
    const color = this.resolveStroke()
    const width = this.resolveStrokeWidth()
    const path = this.props.path
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
        styles: { color, width, opacity, dashPattern: [6, 4] },
      })
    }
    this.appendMarkers(schema, path, color, width, opacity)
    return schema
  }

  private appendMarkers(schema: NovaSchema, path: Array<ModelerPoint>, color: string, width: number, opacity: number): void {
    const start = path[0]!
    const next = this.findNextDistinctPoint(path, 1, start)
    if (next) {
      schema.push({
        type: 'circle',
        x: start.x,
        y: start.y,
          radius: 4.5,
        styles: {
          background: '#ffffff',
          border: { color, width },
          opacity,
        },
      })
    }
    const end = path[path.length - 1]!
    const previous = this.findPreviousDistinctPoint(path, path.length - 2, end)
    if (previous) this.appendOpenArrow(schema, end, previous, color, width, opacity)
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
    const length = 11
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

  private syncViewportTransform(): void {
    const scale = Math.max(0.0001, this.props.viewport.scale)
    this.options({
      x: this.props.viewport.x,
      y: this.props.viewport.y,
      width: Math.ceil(this.surface.width / scale),
      height: Math.ceil(this.surface.height / scale),
      scaleX: scale,
      scaleY: scale,
      interactive: false,
    })
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
    return normalized
  }

  private resolveThemeColor(token: ModelerThemeTokenKey): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }

  private resolveThemeNumber(token: ModelerThemeTokenKey): number {
    const fallback = Number(MODELER_THEME_FALLBACKS[token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(Number(value)) ? Number(value) : fallback
  }
}

export const BPMN_MESSAGE_FLOW_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnMessageFlowViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnMessageFlowViewProps
>(BpmnMessageFlowView as never) as BpmnMessageFlowViewDescriptor
