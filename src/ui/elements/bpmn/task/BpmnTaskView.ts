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
import { resolveBpmnTaskTypeIcon } from '@/elements/bpmn/task/bpmn-task.variants'
import type {
  BpmnTaskElement,
  BpmnTaskElementData,
} from '@/elements/bpmn/task/bpmn-task.types'

export interface BpmnTaskViewProps {
  element: BpmnTaskElement
  viewport: ModelerViewport
  selected?: boolean
}

export interface BpmnTaskViewResolvedProps {
  element: BpmnTaskElement
  viewport: ModelerViewport
  selected: boolean
}

export type BpmnTaskViewDescriptor = NovaComponentDescriptor<
  BpmnTaskViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnTaskViewProps
>

const DEFAULT_TASK_DATA: BpmnTaskElementData = {
  name: 'Task',
  taskType: 'none',
  loopType: 'none',
  isForCompensation: false,
}

@NovaComponent({
  type: Modeler.BpmnTaskView,
  name: 'BpmnTaskView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'selected'],
  },
})
export class BpmnTaskView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnTaskViewResolvedProps, Record<string, never>, Record<string, never>, BpmnTaskViewProps, E> {
  @Prop.object<BpmnTaskElement>({ required: true })
  declare element: BpmnTaskElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnTaskViewDescriptor,
    props: BpmnTaskViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnTaskViewProps): BpmnTaskViewResolvedProps {
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
    this.renderer.schema(this.createTaskSchema())
  }

  private createTaskSchema(): NovaSchema {
    const element = this.props.element
    const data = this.resolveTaskData()
    const style = element.style ?? {}
    const borderColor = this.props.selected
      ? String(style.selectedStroke ?? this.resolveThemeColor('bpmnTaskSelectedStroke', 'elementSelectedStroke'))
      : String(style.stroke ?? this.resolveThemeColor('bpmnTaskStroke', 'elementStroke'))
    const schema: NovaSchema = [{
      type: 'rect',
      x: -this.width / 2,
      y: -this.height / 2,
      width: this.width,
      height: this.height,
      styles: {
        background: String(style.fill ?? this.resolveThemeColor('bpmnTaskFill', 'elementFill')),
        border: {
          color: borderColor,
          width: Number(style.strokeWidth ?? this.resolveThemeNumber('bpmnTaskStrokeWidth', 'elementStrokeWidth')),
          radius: Number(style.radius ?? this.resolveThemeNumber('bpmnTaskRadius')),
        },
        opacity: Number(style.opacity ?? this.resolveThemeNumber('elementOpacity')),
      },
    }]

    this.appendTaskTypeMarker(schema)
    this.appendTaskName(schema, data.name)
    this.appendBottomMarkers(schema)
    return schema
  }

  private appendTaskTypeMarker(schema: NovaSchema): void {
    const data = this.resolveTaskData()
    const icon = resolveBpmnTaskTypeIcon(data.taskType)
    if (!icon) return
    const size = Math.max(14, Math.min(22, Math.min(this.width, this.height) * 0.24))
    schema.push({
      type: 'icon',
      icon,
      x: -this.width / 2 + 10,
      y: -this.height / 2 + 9,
      width: size,
      height: size,
      styles: { opacity: 0.95 },
    })
  }

  private appendTaskName(schema: NovaSchema, name: string): void {
    const hasIcon = this.resolveTaskData().taskType !== 'none'
    schema.push({
      type: 'text',
      text: name,
      x: -this.width / 2 + 12,
      y: -this.height / 2 + 14,
      width: Math.max(1, this.width - 24),
      height: Math.max(12, this.height - 28),
      styles: {
        color: this.resolveThemeColor('bpmnTaskTextColor'),
        font: {
          family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          size: Math.max(11, Math.min(14, this.height * 0.16)),
          weight: '500',
        },
        lineHeight: Math.max(14, Math.min(20, this.height * 0.2)),
        padding: hasIcon ? { top: 0, right: 0, bottom: 0, left: 22 } : undefined,
        align: { horizontal: 'center', vertical: 'middle' },
        ellipsis: true,
      },
    })
  }

  private appendBottomMarkers(schema: NovaSchema): void {
    const data = this.resolveTaskData()
    const markers = [
      data.loopType !== 'none' ? data.loopType : null,
      data.isForCompensation ? 'compensation' : null,
      data.taskType === 'receive' && data.instantiate ? 'instantiate' : null,
    ].filter(Boolean) as Array<string>
    if (markers.length === 0) return
    const gap = 6
    const markerWidth = 16
    const totalWidth = markerWidth * markers.length + gap * (markers.length - 1)
    let x = -totalWidth / 2
    const y = this.height / 2 - 15
    markers.forEach(marker => {
      if (marker === 'standard') this.appendLoopMarker(schema, x, y)
      else if (marker === 'multiInstanceParallel') this.appendMultiInstanceMarker(schema, x, y, true)
      else if (marker === 'multiInstanceSequential') this.appendMultiInstanceMarker(schema, x, y, false)
      else if (marker === 'compensation') this.appendCompensationMarker(schema, x, y)
      else this.appendInstantiateMarker(schema, x, y)
      x += markerWidth + gap
    })
  }

  private appendLoopMarker(schema: NovaSchema, x: number, y: number): void {
    const color = this.resolveThemeColor('bpmnTaskMarkerStroke')
    schema.push({
      type: 'arc',
      x: x + 8,
      y: y + 8,
      radius: 5,
      startAngle: Math.PI * 0.15,
      endAngle: Math.PI * 1.85,
      styles: { color, width: 1.6, lineCap: 'round' },
    })
    schema.push({
      type: 'line',
      x1: x + 12.5,
      y1: y + 5,
      x2: x + 15,
      y2: y + 5.5,
      styles: { color, width: 1.6 },
    })
  }

  private appendMultiInstanceMarker(schema: NovaSchema, x: number, y: number, vertical: boolean): void {
    const color = this.resolveThemeColor('bpmnTaskMarkerStroke')
    for (let index = 0; index < 3; index += 1) {
      if (vertical) {
        schema.push({ type: 'line', x1: x + 4 + index * 4, y1: y + 3, x2: x + 4 + index * 4, y2: y + 13, styles: { color, width: 1.7 } })
      } else {
        schema.push({ type: 'line', x1: x + 3, y1: y + 4 + index * 4, x2: x + 13, y2: y + 4 + index * 4, styles: { color, width: 1.7 } })
      }
    }
  }

  private appendCompensationMarker(schema: NovaSchema, x: number, y: number): void {
    const color = this.resolveThemeColor('bpmnTaskMarkerStroke')
    schema.push({
      type: 'polygon',
      points: [{ x: x + 2, y: y + 8 }, { x: x + 8, y: y + 3 }, { x: x + 8, y: y + 13 }],
      styles: { background: 'rgba(0,0,0,0)', stroke: color, lineWidth: 1.5 },
    })
    schema.push({
      type: 'polygon',
      points: [{ x: x + 8, y: y + 8 }, { x: x + 14, y: y + 3 }, { x: x + 14, y: y + 13 }],
      styles: { background: 'rgba(0,0,0,0)', stroke: color, lineWidth: 1.5 },
    })
  }

  private appendInstantiateMarker(schema: NovaSchema, x: number, y: number): void {
    const color = this.resolveThemeColor('bpmnTaskMarkerStroke')
    schema.push({
      type: 'circle',
      x: x + 8,
      y: y + 8,
      radius: 5,
      styles: { background: 'rgba(0,0,0,0)', border: { color, width: 1.5 } },
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

  private resolveTaskData(): BpmnTaskElementData {
    return this.props.element.data ?? DEFAULT_TASK_DATA
  }
}

export const MODELER_BPMN_TASK_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnTaskViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnTaskViewProps
>(BpmnTaskView as never) as BpmnTaskViewDescriptor
