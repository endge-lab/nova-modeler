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
import type { BpmnGroupElement } from '@/elements/bpmn/artifacts/group/bpmn-group.types'

export interface BpmnGroupViewProps {
  element: BpmnGroupElement
  viewport: ModelerViewport
  selected?: boolean
  hideName?: boolean
}

export interface BpmnGroupViewResolvedProps {
  element: BpmnGroupElement
  viewport: ModelerViewport
  selected: boolean
  hideName: boolean
}

export type BpmnGroupViewDescriptor = NovaComponentDescriptor<
  BpmnGroupViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnGroupViewProps
>

@NovaComponent({
  type: Modeler.BpmnGroupView,
  name: 'BpmnGroupView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'viewport', 'selected', 'hideName'],
  },
})
export class BpmnGroupView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnGroupViewResolvedProps, Record<string, never>, Record<string, never>, BpmnGroupViewProps, E> {
  @Prop.object<BpmnGroupElement>({ required: true })
  declare element: BpmnGroupElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnGroupViewDescriptor,
    props: BpmnGroupViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnGroupViewProps): BpmnGroupViewResolvedProps {
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
    this.renderer.schema(this.createSchema())
  }

  private createSchema(): NovaSchema {
    const style = this.props.element.style ?? {}
    const stroke = this.props.selected
      ? String(style.selectedStroke ?? this.resolveThemeColor('elementSelectedStroke'))
      : String(style.stroke ?? this.resolveThemeColor('elementStroke'))
    const strokeWidth = this.resolveStyleNumber(style.strokeWidth, 'elementStrokeWidth')
    const opacity = this.resolveStyleNumber(style.opacity, 'elementOpacity')
    const schema: NovaSchema = [{
      type: 'rect',
      x: -this.width / 2,
      y: -this.height / 2,
      width: this.width,
      height: this.height,
      styles: {
        background: String(style.fill ?? 'rgba(0,0,0,0)'),
        border: {
          color: stroke,
          width: strokeWidth,
          radius: Number(style.radius ?? 4),
          dashPattern: [6, 4],
        },
        opacity,
      },
    }]
    const name = this.props.element.data?.name
    if (name && !this.props.hideName) {
      const layout = resolveBpmnGroupNameLayout({
        name,
        width: this.width,
        height: this.height,
      })
      schema.push({
        type: 'text',
        text: layout.text,
        x: layout.rect.x,
        y: layout.rect.y,
        width: layout.rect.width,
        height: layout.rect.height,
        clip: true,
        styles: {
          color: this.resolveThemeColor('bpmnTaskTextColor'),
          font: {
            family: layout.fontFamily,
            size: layout.fontSize,
            weight: layout.fontWeight,
          },
          lineHeight: layout.lineHeight,
          align: { horizontal: 'left', vertical: 'top' },
          ellipsis: true,
        },
      })
    }
    return schema
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

export interface BpmnGroupNameLayout {
  text: string
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  lines: Array<{
    text: string
    x: number
    y: number
    width: number
    widthLimit: number
    height: number
  }>
  clipped: boolean
  fontFamily: string
  fontSize: number
  fontWeight: '500'
  lineHeight: number
}

const BPMN_GROUP_NAME_FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const BPMN_GROUP_NAME_FONT_SIZE = 12
const BPMN_GROUP_NAME_FONT_WEIGHT = '500' as const

export function resolveBpmnGroupNameLayout(input: {
  name?: string
  width: number
  height: number
}): BpmnGroupNameLayout {
  const text = typeof input.name === 'string' && input.name.trim().length > 0 ? input.name : 'Group'
  const fontSize = Math.max(1, Math.min(BPMN_GROUP_NAME_FONT_SIZE, input.height * 0.075))
  const lineHeight = Math.max(1, fontSize * 1.333)
  const insetX = input.width * 0.042
  const insetY = input.height * 0.05
  const rect = {
    x: -input.width / 2 + insetX,
    y: -input.height / 2 + insetY,
    width: Math.max(1, input.width - insetX * 2),
    height: lineHeight * 1.125,
  }
  const textWidth = measureBpmnGroupNameText(text, fontSize)
  return {
    text,
    rect,
    lines: [{
      text,
      x: rect.x,
      y: rect.y,
      width: textWidth,
      widthLimit: rect.width,
      height: lineHeight,
    }],
    clipped: textWidth > rect.width,
    fontFamily: BPMN_GROUP_NAME_FONT_FAMILY,
    fontSize,
    fontWeight: BPMN_GROUP_NAME_FONT_WEIGHT,
    lineHeight,
  }
}

let bpmnGroupNameMeasureCanvas: HTMLCanvasElement | null = null

function measureBpmnGroupNameText(text: string, fontSize = BPMN_GROUP_NAME_FONT_SIZE): number {
  if (typeof document === 'undefined') return Math.ceil(text.length * fontSize * 0.6)
  bpmnGroupNameMeasureCanvas ??= document.createElement('canvas')
  const context = bpmnGroupNameMeasureCanvas.getContext('2d')
  if (!context) return Math.ceil(text.length * fontSize * 0.6)
  context.font = `normal ${BPMN_GROUP_NAME_FONT_WEIGHT} ${fontSize}px ${BPMN_GROUP_NAME_FONT_FAMILY}`
  return Math.ceil(context.measureText(text).width)
}

export const MODELER_BPMN_GROUP_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnGroupViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnGroupViewProps
>(BpmnGroupView as never) as BpmnGroupViewDescriptor
