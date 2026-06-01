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
  ModelerRect,
  ModelerViewport,
} from '@/domain/types'
import {
  createBpmnParticipantLayout,
  normalizeBpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type {
  BpmnParticipantElement,
  BpmnParticipantLayout,
  BpmnParticipantLayoutLane,
} from '@/elements/bpmn/participant/bpmn-participant.types'
import type { BpmnTaskNameLayout } from '@/ui/elements/bpmn/task/BpmnTaskView'

export interface BpmnParticipantViewProps {
  element: BpmnParticipantElement
  viewport: ModelerViewport
  selected?: boolean
  hideName?: boolean
}

export interface BpmnParticipantViewResolvedProps {
  element: BpmnParticipantElement
  viewport: ModelerViewport
  selected: boolean
  hideName: boolean
}

export type BpmnParticipantViewDescriptor = NovaComponentDescriptor<
  BpmnParticipantViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnParticipantViewProps
>

const PARTICIPANT_LABEL_FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const PARTICIPANT_LABEL_FONT_SIZE = 12
const PARTICIPANT_LABEL_FONT_WEIGHT = '500' as const
const PARTICIPANT_LABEL_LINE_HEIGHT = 16

export function resolveBpmnParticipantNameLayout(input: {
  element: BpmnParticipantElement
  width: number
  height: number
  partType?: string
  partId?: string
  scale?: number
}): BpmnTaskNameLayout {
  const layout = createBpmnParticipantLayout({
    ...input.element,
    x: -input.width / 2,
    y: -input.height / 2,
    width: input.width,
    height: input.height,
  })
  const isLane = input.partType === 'bpmn.swimlane.lane'
  const lane = isLane ? layout.lanes.find(item => item.id === input.partId) : undefined
  const rect = lane?.headerRect ?? layout.participantHeaderRect
  const text = lane?.name ?? input.element.data?.name ?? 'Participant'
  return createLabelLayout(text, rect, input.element.data?.orientation, input.scale)
}

@NovaComponent({
  type: Modeler.BpmnParticipantView,
  name: 'BpmnParticipantView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'viewport', 'selected', 'hideName'],
  },
})
export class BpmnParticipantView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnParticipantViewResolvedProps, Record<string, never>, Record<string, never>, BpmnParticipantViewProps, E> {
  @Prop.object<BpmnParticipantElement>({ required: true })
  declare element: BpmnParticipantElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnParticipantViewDescriptor,
    props: BpmnParticipantViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnParticipantViewProps): BpmnParticipantViewResolvedProps {
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
    const element = this.props.element
    const style = element.style ?? {}
    const selected = this.props.selected
    const borderColor = selected
      ? String(style.selectedStroke ?? this.resolveThemeColor('elementSelectedStroke'))
      : String(style.stroke ?? this.resolveThemeColor('elementStroke'))
    const strokeWidth = this.resolveStyleNumber(style.strokeWidth, 'elementStrokeWidth') * this.props.viewport.scale
    const layout = this.createLocalLayout()
    const schema: NovaSchema = [{
      type: 'rect',
      ...layout.bounds,
      styles: {
        background: String(style.fill ?? this.resolveThemeColor('elementFill')),
        border: {
          color: borderColor,
          width: strokeWidth,
          radius: Number(style.radius ?? 4) * this.props.viewport.scale,
        },
        opacity: this.resolveStyleNumber(style.opacity, 'elementOpacity'),
      },
    }]

    this.appendHeaders(schema, layout.participantHeaderRect, layout.laneHeaderAreaRect)
    this.appendLaneLines(schema, layout.lanes)
    if (!this.props.hideName) this.appendLabels(schema)
    return schema
  }

  private appendHeaders(schema: NovaSchema, participantHeader: ModelerRect, laneHeaderArea: ModelerRect): void {
    const headerFill = 'rgba(248, 250, 252, 0.66)'
    const color = this.resolveThemeColor('elementStroke')
    schema.push({
      type: 'rect',
      ...participantHeader,
      styles: { background: headerFill, border: { color, width: 0, radius: 0 } },
    })
    schema.push({
      type: 'rect',
      ...laneHeaderArea,
      styles: { background: headerFill, border: { color, width: 0, radius: 0 } },
    })
    const participant = participantHeader
    const laneHeader = laneHeaderArea
    if (normalizeBpmnParticipantOrientation(this.props.element.data?.orientation) === 'vertical') {
      schema.push({ type: 'line', x1: participant.x, y1: participant.y + participant.height, x2: participant.x + participant.width, y2: participant.y + participant.height, styles: { color, width: this.props.viewport.scale } })
      schema.push({ type: 'line', x1: laneHeader.x, y1: laneHeader.y + laneHeader.height, x2: laneHeader.x + laneHeader.width, y2: laneHeader.y + laneHeader.height, styles: { color, width: this.props.viewport.scale } })
      return
    }
    schema.push({ type: 'line', x1: participant.x + participant.width, y1: participant.y, x2: participant.x + participant.width, y2: participant.y + participant.height, styles: { color, width: this.props.viewport.scale } })
    schema.push({ type: 'line', x1: laneHeader.x + laneHeader.width, y1: laneHeader.y, x2: laneHeader.x + laneHeader.width, y2: laneHeader.y + laneHeader.height, styles: { color, width: this.props.viewport.scale } })
  }

  private appendLaneLines(schema: NovaSchema, lanes: Array<BpmnParticipantLayoutLane>): void {
    const color = this.resolveThemeColor('elementStroke')
    const orientation = normalizeBpmnParticipantOrientation(this.props.element.data?.orientation)
    lanes.slice(1).forEach(lane => {
      const rect = lane.rect
      if (orientation === 'vertical') {
        schema.push({ type: 'line', x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height, styles: { color, width: this.props.viewport.scale } })
      } else {
        schema.push({ type: 'line', x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y, styles: { color, width: this.props.viewport.scale } })
      }
    })
  }

  private appendLabels(schema: NovaSchema): void {
    const element = this.props.element
    const layout = this.createLocalLayout()
    const participant = createRenderLabelLayout(
      element.data?.name ?? 'Participant',
      layout.participantHeaderRect,
      element.data?.orientation,
      this.props.viewport.scale,
    )
    this.appendLabel(schema, participant)
    layout.lanes.forEach(lane => {
      const laneLayout = createRenderLabelLayout(lane.name, lane.headerRect, element.data?.orientation, this.props.viewport.scale)
      this.appendLabel(schema, laneLayout)
    })
  }

  private appendLabel(schema: NovaSchema, layout: BpmnTaskNameLayout): void {
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
          align: { horizontal: 'center', vertical: 'middle' },
          ellipsis: true,
        },
      })
    }
  }

  private createLocalLayout(): BpmnParticipantLayout {
    const world = createBpmnParticipantLayout(this.props.element)
    return {
      bounds: this.toLocalRect(world.bounds),
      participantHeaderRect: this.toLocalRect(world.participantHeaderRect),
      laneHeaderAreaRect: this.toLocalRect(world.laneHeaderAreaRect),
      contentRect: this.toLocalRect(world.contentRect),
      lanes: world.lanes.map(lane => ({
        ...lane,
        rect: this.toLocalRect(lane.rect),
        headerRect: this.toLocalRect(lane.headerRect),
        contentRect: this.toLocalRect(lane.contentRect),
      })),
    }
  }

  private toLocalRect(rect: ModelerRect): ModelerRect {
    const element = this.props.element
    const scale = this.props.viewport.scale
    return {
      x: (rect.x - element.x - element.width / 2) * scale,
      y: (rect.y - element.y - element.height / 2) * scale,
      width: rect.width * scale,
      height: rect.height * scale,
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

function createLabelLayout(
  text: string,
  rect: ModelerRect,
  orientation: unknown,
  scale = 1,
): BpmnTaskNameLayout {
  const normalizedText = typeof text === 'string' && text.trim().length > 0 ? text : 'Lane'
  const isHorizontal = normalizeBpmnParticipantOrientation(orientation) === 'horizontal'
  const fontSize = Math.max(1, PARTICIPANT_LABEL_FONT_SIZE * scale)
  const lineHeight = Math.max(1, PARTICIPANT_LABEL_LINE_HEIGHT * scale)
  const insetX = 4 * scale
  const verticalInset = 8 * scale
  const textRect = isHorizontal
    ? {
        x: rect.x + insetX,
        y: rect.y + Math.max(0, (rect.height - lineHeight) / 2),
        width: Math.max(1, rect.width - insetX * 2),
        height: lineHeight,
      }
    : {
        x: rect.x + verticalInset,
        y: rect.y + Math.max(0, (rect.height - lineHeight) / 2),
        width: Math.max(1, rect.width - verticalInset * 2),
        height: lineHeight,
      }
  const textWidth = measureParticipantLabelText(normalizedText, fontSize)
  return {
    text: normalizedText,
    rect: textRect,
    lines: [{
      text: normalizedText,
      x: textRect.x,
      y: textRect.y,
      width: textWidth,
      widthLimit: textRect.width,
      height: lineHeight,
    }],
    clipped: textWidth > textRect.width,
    fontFamily: PARTICIPANT_LABEL_FONT_FAMILY,
    fontSize,
    fontWeight: PARTICIPANT_LABEL_FONT_WEIGHT,
    lineHeight,
  }
}

function createRenderLabelLayout(
  text: string,
  rect: ModelerRect,
  orientation: unknown,
  scale = 1,
): BpmnTaskNameLayout {
  if (normalizeBpmnParticipantOrientation(orientation) !== 'horizontal') {
    return createLabelLayout(text, rect, orientation, scale)
  }
  const normalizedText = typeof text === 'string' && text.trim().length > 0 ? text : 'Lane'
  const characters = [...normalizedText.replace(/\s+/g, ' ')]
  const fontSize = Math.max(1, PARTICIPANT_LABEL_FONT_SIZE * scale)
  const lineHeight = Math.max(1, PARTICIPANT_LABEL_LINE_HEIGHT * scale)
  const inset = 4 * scale
  const maxLines = Math.max(1, Math.floor((rect.height - inset * 2) / lineHeight))
  const visible = characters.slice(0, maxLines)
  const clipped = characters.length > maxLines
  if (clipped && visible.length > 0) visible[visible.length - 1] = '.'
  const contentHeight = visible.length * lineHeight
  const startY = rect.y + Math.max(inset, (rect.height - contentHeight) / 2)
  return {
    text: normalizedText,
    rect,
    lines: visible.map((character, index) => ({
      text: character,
      x: rect.x + 2 * scale,
      y: startY + index * lineHeight,
      width: fontSize,
      widthLimit: Math.max(1, rect.width - 4 * scale),
      height: lineHeight,
    })),
    clipped,
    fontFamily: PARTICIPANT_LABEL_FONT_FAMILY,
    fontSize,
    fontWeight: PARTICIPANT_LABEL_FONT_WEIGHT,
    lineHeight,
  }
}

let participantLabelMeasureCanvas: HTMLCanvasElement | null = null

function measureParticipantLabelText(text: string, fontSize = PARTICIPANT_LABEL_FONT_SIZE): number {
  if (typeof document === 'undefined') return Math.ceil(text.length * fontSize * 0.6)
  participantLabelMeasureCanvas ??= document.createElement('canvas')
  const context = participantLabelMeasureCanvas.getContext('2d')
  if (!context) return Math.ceil(text.length * fontSize * 0.6)
  context.font = `normal ${PARTICIPANT_LABEL_FONT_WEIGHT} ${fontSize}px ${PARTICIPANT_LABEL_FONT_FAMILY}`
  return Math.ceil(context.measureText(text).width)
}

export const MODELER_BPMN_PARTICIPANT_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnParticipantViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnParticipantViewProps
>(BpmnParticipantView as never) as BpmnParticipantViewDescriptor
