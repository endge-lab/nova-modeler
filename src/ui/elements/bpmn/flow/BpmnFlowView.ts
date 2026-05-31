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
}

export interface BpmnFlowViewResolvedProps {
  element: BpmnFlowElement
  viewport: ModelerViewport
  path: Array<ModelerPoint>
  selected: boolean
  preview: boolean
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
    render: ['element', 'path', 'selected', 'preview'],
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
    const path = this.props.path.map(point => this.worldToScreen(point))
    if (path.length < 2) return []
    const color = this.resolveStroke()
    const width = Number(this.props.element.style?.strokeWidth ?? this.resolveThemeNumber('bpmnFlowStrokeWidth'))
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
        styles: { color, width, opacity },
      })
    }
    this.appendTargetArrow(schema, path, color, width, opacity)
    this.appendSourceMarker(schema, path, color, width, opacity)
    return schema
  }

  private appendTargetArrow(schema: NovaSchema, path: Array<ModelerPoint>, color: string, width: number, opacity: number): void {
    const end = path[path.length - 1]!
    const previous = this.findPreviousDistinctPoint(path, path.length - 2, end)
    if (!previous) return
    const angle = Math.atan2(end.y - previous.y, end.x - previous.x)
    const length = 12
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
        stroke: color,
        lineWidth: width,
        opacity,
      },
    })
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
      x: start.x + Math.cos(angle) * 10,
      y: start.y + Math.sin(angle) * 10,
    }
    const size = 6
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
      x: start.x + Math.cos(angle) * 10,
      y: start.y + Math.sin(angle) * 10,
    }
    const normal = angle + Math.PI / 2
    const tangent = angle
    const offset = 6
    schema.push({
      type: 'line',
      x1: center.x - Math.cos(normal) * offset - Math.cos(tangent) * 4,
      y1: center.y - Math.sin(normal) * offset - Math.sin(tangent) * 4,
      x2: center.x + Math.cos(normal) * offset + Math.cos(tangent) * 4,
      y2: center.y + Math.sin(normal) * offset + Math.sin(tangent) * 4,
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

  private resolveStroke(): string {
    const style = this.props.element.style ?? {}
    if (this.props.preview) return String(style.stroke ?? this.resolveThemeColor('bpmnFlowPreviewStroke'))
    if (this.props.selected) return String(style.selectedStroke ?? this.resolveThemeColor('bpmnFlowSelectedStroke'))
    return String(style.stroke ?? this.resolveThemeColor('bpmnFlowStroke'))
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
