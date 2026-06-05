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
  areBpmnParticipantLaneHeadersVisible,
  createBpmnParticipantLayout,
  normalizeBpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type {
  BpmnParticipantElement,
  BpmnParticipantLane,
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
const HORIZONTAL_PARTICIPANT_LABEL_ROTATION = -Math.PI / 2

type BpmnParticipantLabelLayout = BpmnTaskNameLayout & {
  rotation?: number
}

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
    update: ['element'],
    render: ['element', 'selected', 'hideName'],
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
    this.options({ width: props.element.width, height: props.element.height, interactive: false })
    this.syncViewportTransform()
  }

  static normalizeProps(props: BpmnParticipantViewProps): BpmnParticipantViewResolvedProps {
    return {
      element: props.element,
      viewport: props.viewport,
      selected: props.selected ?? false,
      hideName: props.hideName ?? false,
    }
  }

  override setProps(patch: Partial<BpmnParticipantViewResolvedProps>): this {
    const changedKeys = (Object.keys(patch) as Array<keyof BpmnParticipantViewResolvedProps>)
      .filter(key => patch[key] !== undefined && this.props[key] !== patch[key])
    if (changedKeys.length === 0) return this

    const nextElement = patch.element ?? this.props.element
    const nextViewport = patch.viewport ?? this.props.viewport
    const nextSelected = patch.selected ?? this.props.selected
    const nextHideName = patch.hideName ?? this.props.hideName
    const transformOnly = nextSelected === this.props.selected
      && nextHideName === this.props.hideName
      && areBpmnParticipantRenderInputsEqual(this.props.element, nextElement)
      && changedKeys.every(key => key === 'element' || key === 'viewport')
    if (transformOnly) {
      const elementChanged = this.props.element !== nextElement
      const viewportChanged = this.props.viewport !== nextViewport
      this.props.element = nextElement
      this.props.viewport = nextViewport
      this.syncViewportTransform()
      if (elementChanged) this.notifySyncPortChanged('element', this.props.element)
      if (viewportChanged) this.notifySyncPortChanged('viewport', this.props.viewport)
      this.dirty({ matrix: true })
      return this
    }

    return super.setProps(patch)
  }

  update(): void {
    super.update()
    this.syncViewportTransform()
  }

  private syncViewportTransform(): void {
    const element = this.props.element
    const viewport = this.props.viewport
    const scale = viewport.scale
    this.options({
      x: (element.x + element.width / 2) * scale + viewport.x,
      y: (element.y + element.height / 2) * scale + viewport.y,
      scaleX: scale,
      scaleY: scale,
      width: element.width,
      height: element.height,
      rotation: element.rotation ?? 0,
      interactive: false,
    })
    this.setLocalRenderBounds({
      x: -element.width / 2,
      y: -element.height / 2,
      width: element.width,
      height: element.height,
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
    const strokeWidth = this.resolveStyleNumber(style.strokeWidth, 'elementStrokeWidth')
    const layout = this.createLocalLayout()
    const schema: NovaSchema = [{
      type: 'rect',
      ...layout.bounds,
      styles: {
        background: String(style.fill ?? this.resolveThemeColor('elementFill')),
        border: {
          color: borderColor,
          width: strokeWidth,
          radius: Number(style.radius ?? 4),
        },
        opacity: this.resolveStyleNumber(style.opacity, 'elementOpacity'),
      },
    }]

    const laneHeadersVisible = areBpmnParticipantLaneHeadersVisible(element)
    this.appendLaneBackgrounds(schema, layout.lanes, laneHeadersVisible)
    this.appendHeaders(schema, layout.participantHeaderRect, layout.laneHeaderAreaRect, laneHeadersVisible, strokeWidth)
    this.appendLaneLines(schema, layout.lanes, strokeWidth)
    if (!this.props.hideName) this.appendLabels(schema)
    return schema
  }

  private appendLaneBackgrounds(schema: NovaSchema, lanes: Array<BpmnParticipantLayoutLane>, laneHeadersVisible: boolean): void {
    const headerFill = 'rgba(248, 250, 252, 0.66)'
    lanes.forEach(lane => {
      const fill = typeof lane.style?.fill === 'string' ? lane.style.fill : undefined
      if (fill) {
        schema.push({
          type: 'rect',
          ...lane.contentRect,
          styles: { background: fill, border: { color: 'rgba(0,0,0,0)', width: 0, radius: 0 } },
        })
      }
      if (!laneHeadersVisible) return
      schema.push({
        type: 'rect',
        ...lane.headerRect,
        styles: { background: fill ?? headerFill, border: { color: 'rgba(0,0,0,0)', width: 0, radius: 0 } },
      })
    })
  }

  private appendHeaders(
    schema: NovaSchema,
    participantHeader: ModelerRect,
    laneHeaderArea: ModelerRect,
    laneHeadersVisible: boolean,
    strokeWidth: number,
  ): void {
    const headerFill = 'rgba(248, 250, 252, 0.66)'
    const color = this.resolveThemeColor('elementStroke')
    schema.push({
      type: 'rect',
      ...participantHeader,
      styles: { background: headerFill, border: { color, width: 0, radius: 0 } },
    })
    const participant = participantHeader
    const laneHeader = laneHeaderArea
    if (normalizeBpmnParticipantOrientation(this.props.element.data?.orientation) === 'vertical') {
      schema.push({ type: 'line', x1: participant.x, y1: participant.y + participant.height, x2: participant.x + participant.width, y2: participant.y + participant.height, styles: { color, width: strokeWidth } })
      if (laneHeadersVisible) {
        schema.push({ type: 'line', x1: laneHeader.x, y1: laneHeader.y + laneHeader.height, x2: laneHeader.x + laneHeader.width, y2: laneHeader.y + laneHeader.height, styles: { color, width: strokeWidth } })
      }
      return
    }
    schema.push({ type: 'line', x1: participant.x + participant.width, y1: participant.y, x2: participant.x + participant.width, y2: participant.y + participant.height, styles: { color, width: strokeWidth } })
    if (laneHeadersVisible) {
      schema.push({ type: 'line', x1: laneHeader.x + laneHeader.width, y1: laneHeader.y, x2: laneHeader.x + laneHeader.width, y2: laneHeader.y + laneHeader.height, styles: { color, width: strokeWidth } })
    }
  }

  private appendLaneLines(schema: NovaSchema, lanes: Array<BpmnParticipantLayoutLane>, strokeWidth: number): void {
    const color = this.resolveThemeColor('elementStroke')
    const orientation = normalizeBpmnParticipantOrientation(this.props.element.data?.orientation)
    lanes.slice(1).forEach(lane => {
      const rect = lane.rect
      if (orientation === 'vertical') {
        schema.push({ type: 'line', x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height, styles: { color, width: strokeWidth } })
      } else {
        schema.push({ type: 'line', x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y, styles: { color, width: strokeWidth } })
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
    )
    this.appendLabel(schema, participant)
    if (areBpmnParticipantLaneHeadersVisible(element)) {
      layout.lanes.forEach(lane => {
        const laneLayout = createRenderLabelLayout(lane.name, lane.headerRect, element.data?.orientation)
        this.appendLabel(schema, laneLayout)
      })
    }
  }

  private appendLabel(schema: NovaSchema, layout: BpmnParticipantLabelLayout): void {
    const color = this.resolveThemeColor('bpmnTaskTextColor')
    for (const line of layout.lines) {
      schema.push({
        type: 'text',
        text: line.text,
        x: line.x,
        y: line.y,
        width: line.widthLimit,
        height: line.height,
        rotation: layout.rotation,
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
    return {
      x: rect.x - element.x - element.width / 2,
      y: rect.y - element.y - element.height / 2,
      width: rect.width,
      height: rect.height,
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
): BpmnParticipantLabelLayout {
  if (normalizeBpmnParticipantOrientation(orientation) !== 'horizontal') {
    return createLabelLayout(text, rect, orientation, scale)
  }
  const normalizedText = typeof text === 'string' && text.trim().length > 0 ? text : 'Lane'
  const fontSize = Math.max(1, PARTICIPANT_LABEL_FONT_SIZE * scale)
  const lineHeight = Math.max(1, PARTICIPANT_LABEL_LINE_HEIGHT * scale)
  const inset = 8 * scale
  const widthLimit = Math.max(1, rect.height - inset * 2)
  const textWidth = measureParticipantLabelText(normalizedText, fontSize)
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  return {
    text: normalizedText,
    rect,
    lines: [{
      text: normalizedText,
      x: centerX - widthLimit / 2,
      y: centerY - lineHeight / 2,
      width: textWidth,
      widthLimit,
      height: lineHeight,
    }],
    clipped: textWidth > widthLimit,
    fontFamily: PARTICIPANT_LABEL_FONT_FAMILY,
    fontSize,
    fontWeight: PARTICIPANT_LABEL_FONT_WEIGHT,
    lineHeight,
    rotation: HORIZONTAL_PARTICIPANT_LABEL_ROTATION,
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

function areBpmnParticipantRenderInputsEqual(prev: BpmnParticipantElement, next: BpmnParticipantElement): boolean {
  if (prev === next) return true
  if (prev.id !== next.id) return false
  if (prev.type !== next.type) return false
  if (prev.width !== next.width || prev.height !== next.height) return false
  if (!recordsEqual(prev.style, next.style)) return false
  const prevData = (prev.data ?? {}) as Partial<NonNullable<BpmnParticipantElement['data']>>
  const nextData = (next.data ?? {}) as Partial<NonNullable<BpmnParticipantElement['data']>>
  if (prevData.name !== nextData.name) return false
  if (prevData.orientation !== nextData.orientation) return false
  if (prevData.singleLaneVisible !== nextData.singleLaneVisible) return false
  const prevLanes: Array<BpmnParticipantLane> = Array.isArray(prevData.lanes) ? prevData.lanes : []
  const nextLanes: Array<BpmnParticipantLane> = Array.isArray(nextData.lanes) ? nextData.lanes : []
  if (prevLanes.length !== nextLanes.length) return false
  return prevLanes.every((lane, index) => {
    const nextLane = nextLanes[index]
    if (!nextLane) return false
    return lane.id === nextLane.id
      && lane.name === nextLane.name
      && lane.size === nextLane.size
      && recordsEqual(lane.style, nextLane.style)
  })
}

function recordsEqual(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): boolean {
  const prevRecord = prev ?? {}
  const nextRecord = next ?? {}
  const prevKeys = Object.keys(prevRecord)
  const nextKeys = Object.keys(nextRecord)
  if (prevKeys.length !== nextKeys.length) return false
  return prevKeys.every(key => Object.is(prevRecord[key], nextRecord[key]))
}

export const MODELER_BPMN_PARTICIPANT_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnParticipantViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnParticipantViewProps
>(BpmnParticipantView as never) as BpmnParticipantViewDescriptor
