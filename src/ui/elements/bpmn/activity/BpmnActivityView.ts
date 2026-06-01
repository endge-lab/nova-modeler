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
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import type { BpmnCallActivityElement } from '@/elements/bpmn/call-activity/bpmn-call-activity.types'
import {
  BPMN_SUB_PROCESS_TYPE,
  normalizeBpmnSubProcessType,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import type { BpmnSubProcessElement } from '@/elements/bpmn/sub-process/bpmn-sub-process.types'
import type { BpmnTaskElementData } from '@/elements/bpmn/task/bpmn-task.types'
import {
  resolveBpmnTaskNameLayout,
  type BpmnTaskNameLayout,
} from '@/ui/elements/bpmn/task/BpmnTaskView'

export type BpmnActivityViewElement = BpmnSubProcessElement | BpmnCallActivityElement

export interface BpmnActivityViewProps {
  element: BpmnActivityViewElement
  viewport: ModelerViewport
  selected?: boolean
  hideName?: boolean
}

export interface BpmnActivityViewResolvedProps {
  element: BpmnActivityViewElement
  viewport: ModelerViewport
  selected: boolean
  hideName: boolean
}

export type BpmnActivityViewDescriptor = NovaComponentDescriptor<
  BpmnActivityViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnActivityViewProps
>

const ACTIVITY_MARKER_SIZE = 14

export function resolveBpmnActivityNameLayout(input: {
  name?: string
  width: number
  height: number
  data?: Partial<BpmnTaskElementData> | null
}): BpmnTaskNameLayout {
  return resolveBpmnTaskNameLayout({
    name: input.name,
    width: input.width,
    height: input.height,
    data: {
      taskType: 'none',
      loopType: input.data?.loopType ?? 'none',
      isForCompensation: input.data?.isForCompensation === true,
    },
  })
}

@NovaComponent({
  type: Modeler.BpmnActivityView,
  name: 'BpmnActivityView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'viewport', 'selected', 'hideName'],
  },
})
export class BpmnActivityView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnActivityViewResolvedProps, Record<string, never>, Record<string, never>, BpmnActivityViewProps, E> {
  @Prop.object<BpmnActivityViewElement>({ required: true })
  declare element: BpmnActivityViewElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnActivityViewDescriptor,
    props: BpmnActivityViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnActivityViewProps): BpmnActivityViewResolvedProps {
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
    this.renderer.schema(this.createActivitySchema())
  }

  private createActivitySchema(): NovaSchema {
    const element = this.props.element
    const style = element.style ?? {}
    const selected = this.props.selected
    const borderColor = selected
      ? String(style.selectedStroke ?? this.resolveThemeColor('bpmnTaskSelectedStroke', 'elementSelectedStroke'))
      : String(style.stroke ?? this.resolveThemeColor('bpmnTaskStroke', 'elementStroke'))
    const baseStrokeWidth = Number(style.strokeWidth ?? this.resolveThemeNumber('bpmnTaskStrokeWidth', 'elementStrokeWidth'))
    const radius = Number(style.radius ?? this.resolveThemeNumber('bpmnTaskRadius'))
    const subProcessType = element.type === BPMN_SUB_PROCESS_TYPE
      ? normalizeBpmnSubProcessType(element.data?.subProcessType)
      : 'embedded'
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
          width: element.type === BPMN_CALL_ACTIVITY_TYPE ? Math.max(3, baseStrokeWidth * 1.8) : baseStrokeWidth,
          radius,
          dashPattern: subProcessType === 'event' ? [6, 4] : undefined,
        },
        opacity: Number(style.opacity ?? this.resolveThemeNumber('elementOpacity')),
      },
    }]

    if (subProcessType === 'transaction') this.appendInnerBorder(schema, borderColor, radius)
    if (!this.props.hideName) this.appendActivityName(schema)
    if (element.type === BPMN_SUB_PROCESS_TYPE) this.appendSubProcessMarkers(schema, subProcessType)
    return schema
  }

  private appendInnerBorder(schema: NovaSchema, color: string, radius: number): void {
    const inset = 4
    schema.push({
      type: 'rect',
      x: -this.width / 2 + inset,
      y: -this.height / 2 + inset,
      width: Math.max(0, this.width - inset * 2),
      height: Math.max(0, this.height - inset * 2),
      styles: {
        background: 'rgba(0,0,0,0)',
        border: {
          color,
          width: 1.2,
          radius: Math.max(0, radius - inset),
        },
      },
    })
  }

  private appendActivityName(schema: NovaSchema): void {
    const layout = resolveBpmnActivityNameLayout({
      name: this.props.element.data?.name,
      width: this.width,
      height: this.height,
      data: this.props.element.data,
    })
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

  private appendSubProcessMarkers(schema: NovaSchema, subProcessType: string): void {
    const markerSize = Math.max(1, Math.min(ACTIVITY_MARKER_SIZE, this.height * 0.14))
    const markerY = this.height / 2 - markerSize - this.height * 0.02
    if (subProcessType === 'adHoc') {
      this.appendAdHocMarker(schema, -markerSize - markerSize * 0.3, markerY, markerSize)
      this.appendCollapsedMarker(schema, markerSize * 0.3, markerY, markerSize)
      return
    }
    this.appendCollapsedMarker(schema, -markerSize / 2, markerY, markerSize)
  }

  private appendCollapsedMarker(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this.resolveThemeColor('bpmnTaskMarkerStroke')
    const centerX = x + size / 2
    const centerY = y + size / 2
    const strokeWidth = Math.max(0.5, 1.4 * this.props.viewport.scale)
    schema.push({
      type: 'rect',
      x,
      y,
      width: size,
      height: size,
      styles: {
        background: 'rgba(0,0,0,0)',
        border: { color, width: strokeWidth, radius: Math.max(0.5, 2 * this.props.viewport.scale) },
      },
    })
    schema.push({ type: 'line', x1: centerX - size * 0.28, y1: centerY, x2: centerX + size * 0.28, y2: centerY, styles: { color, width: strokeWidth } })
    schema.push({ type: 'line', x1: centerX, y1: centerY - size * 0.28, x2: centerX, y2: centerY + size * 0.28, styles: { color, width: strokeWidth } })
  }

  private appendAdHocMarker(schema: NovaSchema, x: number, y: number, size: number): void {
    schema.push({
      type: 'text',
      text: '~',
      x,
      y: y - size * 0.14,
      width: size,
      height: size,
      styles: {
        color: this.resolveThemeColor('bpmnTaskMarkerStroke'),
        font: {
          family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          size: Math.max(1, 18 * this.props.viewport.scale),
          weight: '600',
        },
        align: { horizontal: 'center', vertical: 'middle' },
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
}

export const MODELER_BPMN_ACTIVITY_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnActivityViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnActivityViewProps
>(BpmnActivityView as never) as BpmnActivityViewDescriptor
