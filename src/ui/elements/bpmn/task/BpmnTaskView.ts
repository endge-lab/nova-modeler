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
  hideName?: boolean
}

export interface BpmnTaskViewResolvedProps {
  element: BpmnTaskElement
  viewport: ModelerViewport
  selected: boolean
  hideName: boolean
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

const TASK_NAME_FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const TASK_NAME_FONT_WEIGHT = '500' as const
const TASK_NAME_HORIZONTAL_INSET = 8
const TASK_NAME_VERTICAL_INSET = 8
const TASK_NAME_ICON_INLINE_RESERVE = 22
const TASK_NAME_BOTTOM_MARKER_RESERVE = 18
const TASK_NAME_MIN_WIDTH = 1
const TASK_NAME_MIN_HEIGHT = 12
const TASK_NAME_ELLIPSIS = '...'

export interface BpmnTaskNameLayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BpmnTaskNameLayoutLine {
  text: string
  x: number
  y: number
  width: number
  widthLimit: number
  height: number
}

export interface BpmnTaskNameLayout {
  text: string
  rect: BpmnTaskNameLayoutRect
  lines: Array<BpmnTaskNameLayoutLine>
  clipped: boolean
  fontFamily: string
  fontSize: number
  fontWeight: typeof TASK_NAME_FONT_WEIGHT
  lineHeight: number
}

export function resolveBpmnTaskNameLayout(input: {
  name?: string
  width: number
  height: number
  data?: Partial<BpmnTaskElementData> | null
}): BpmnTaskNameLayout {
  const data = { ...DEFAULT_TASK_DATA, ...(input.data ?? {}) }
  const text = normalizeTaskNameText(input.name ?? data.name)
  const width = Math.max(0, input.width)
  const height = Math.max(0, input.height)
  const fontSize = resolveBpmnTaskNameFontSize(height)
  const lineHeight = resolveBpmnTaskNameLineHeight(height)
  const hasIcon = data.taskType !== 'none'
  const hasBottomMarker = data.loopType !== 'none'
    || data.isForCompensation === true
    || (data.taskType === 'receive' && data.instantiate === true)
  const left = TASK_NAME_HORIZONTAL_INSET + (hasIcon ? TASK_NAME_ICON_INLINE_RESERVE : 0)
  const right = TASK_NAME_HORIZONTAL_INSET
  const bottom = TASK_NAME_VERTICAL_INSET + (hasBottomMarker ? TASK_NAME_BOTTOM_MARKER_RESERVE : 0)
  const rect: BpmnTaskNameLayoutRect = {
    x: -width / 2 + left,
    y: -height / 2 + TASK_NAME_VERTICAL_INSET,
    width: Math.max(TASK_NAME_MIN_WIDTH, width - left - right),
    height: Math.max(TASK_NAME_MIN_HEIGHT, height - TASK_NAME_VERTICAL_INSET - bottom),
  }
  const maxLines = Math.max(1, Math.floor(rect.height / lineHeight))
  const sourceLines = buildTaskNameSourceLines(text, rect.width, {
    fontFamily: TASK_NAME_FONT_FAMILY,
    fontSize,
    fontWeight: TASK_NAME_FONT_WEIGHT,
  }, maxLines + 1)
  const visibleLines = sourceLines.slice(0, maxLines)
  const clipped = sourceLines.length > maxLines || visibleLines.some(line => line.width > rect.width)

  if (clipped && visibleLines.length > 0) {
    const lastIndex = visibleLines.length - 1
    visibleLines[lastIndex] = createTaskNameLine(
      fitTaskNameWithEllipsis(visibleLines[lastIndex]?.text ?? '', rect.width, {
        fontFamily: TASK_NAME_FONT_FAMILY,
        fontSize,
        fontWeight: TASK_NAME_FONT_WEIGHT,
      }),
      {
        fontFamily: TASK_NAME_FONT_FAMILY,
        fontSize,
        fontWeight: TASK_NAME_FONT_WEIGHT,
      },
    )
  }

  const contentHeight = visibleLines.length * lineHeight
  const startY = rect.y + Math.max(0, (rect.height - contentHeight) / 2)
  return {
    text,
    rect,
    lines: visibleLines.map((line, index) => ({
      text: line.text,
      x: rect.x,
      y: startY + index * lineHeight,
      width: line.width,
      widthLimit: rect.width,
      height: lineHeight,
    })),
    clipped,
    fontFamily: TASK_NAME_FONT_FAMILY,
    fontSize,
    fontWeight: TASK_NAME_FONT_WEIGHT,
    lineHeight,
  }
}

@NovaComponent({
  type: Modeler.BpmnTaskView,
  name: 'BpmnTaskView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'viewport', 'selected', 'hideName'],
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
    if (!this.props.hideName) this.appendTaskName(schema, data.name)
    this.appendBottomMarkers(schema)
    return schema
  }

  private appendTaskTypeMarker(schema: NovaSchema): void {
    const data = this.resolveTaskData()
    const icon = resolveBpmnTaskTypeIcon(data.taskType)
    if (!icon) return
    const size = Math.max(1, Math.min(22, Math.min(this.width, this.height) * 0.24))
    const insetX = this.width * 0.083
    const insetY = this.height * 0.112
    schema.push({
      type: 'icon',
      icon,
      x: -this.width / 2 + insetX,
      y: -this.height / 2 + insetY,
      width: size,
      height: size,
      styles: { opacity: 0.95 },
    })
  }

  private appendTaskName(schema: NovaSchema, name: string): void {
    const layout = resolveBpmnTaskNameLayout({
      name,
      width: this.width,
      height: this.height,
      data: this.resolveTaskData(),
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

function resolveBpmnTaskNameFontSize(height: number): number {
  return Math.max(1, Math.min(14, height * 0.16))
}

function resolveBpmnTaskNameLineHeight(height: number): number {
  return Math.max(1, Math.min(20, height * 0.2))
}

function buildTaskNameSourceLines(
  text: string,
  width: number,
  style: { fontFamily: string; fontSize: number; fontWeight: string },
  limit: number,
): Array<{ text: string; width: number }> {
  const lines: Array<{ text: string; width: number }> = []
  const paragraphs = normalizeLineEndings(text).split('\n')
  for (const paragraph of paragraphs) {
    const wrapped = wrapTaskNameParagraph(paragraph, width, style)
    lines.push(...wrapped)
    if (lines.length >= limit) return lines.slice(0, limit)
  }
  return lines
}

function wrapTaskNameParagraph(
  paragraph: string,
  width: number,
  style: { fontFamily: string; fontSize: number; fontWeight: string },
): Array<{ text: string; width: number }> {
  const words = paragraph.replace(/[ \t\f\v]+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0) return [createTaskNameLine('', style)]
  const lines: Array<{ text: string; width: number }> = []
  let current = ''

  for (const word of words) {
    if (current.length === 0) {
      if (measureTaskNameText(word, style) <= width) {
        current = word
        continue
      }
      const broken = wrapTaskNameByCharacters(word, width, style)
      lines.push(...broken.slice(0, -1))
      current = broken[broken.length - 1]?.text ?? ''
      continue
    }

    const candidate = `${current} ${word}`
    if (measureTaskNameText(candidate, style) <= width) {
      current = candidate
      continue
    }

    lines.push(createTaskNameLine(current, style))
    if (measureTaskNameText(word, style) > width) {
      const broken = wrapTaskNameByCharacters(word, width, style)
      lines.push(...broken.slice(0, -1))
      current = broken[broken.length - 1]?.text ?? ''
    } else {
      current = word
    }
  }

  if (current.length > 0 || lines.length === 0) lines.push(createTaskNameLine(current, style))
  return lines
}

function wrapTaskNameByCharacters(
  text: string,
  width: number,
  style: { fontFamily: string; fontSize: number; fontWeight: string },
): Array<{ text: string; width: number }> {
  const lines: Array<{ text: string; width: number }> = []
  let current = ''
  for (const char of Array.from(text)) {
    const candidate = `${current}${char}`
    if (current.length > 0 && measureTaskNameText(candidate, style) > width) {
      lines.push(createTaskNameLine(current, style))
      current = char
    } else {
      current = candidate
    }
  }
  if (current.length > 0 || lines.length === 0) lines.push(createTaskNameLine(current, style))
  return lines
}

function fitTaskNameWithEllipsis(
  text: string,
  width: number,
  style: { fontFamily: string; fontSize: number; fontWeight: string },
): string {
  if (width <= 0 || measureTaskNameText(TASK_NAME_ELLIPSIS, style) > width) return ''
  const chars = Array.from(text)
  let left = 0
  let right = chars.length
  while (left < right) {
    const middle = Math.ceil((left + right) / 2)
    const candidate = `${chars.slice(0, middle).join('')}${TASK_NAME_ELLIPSIS}`
    if (measureTaskNameText(candidate, style) <= width) left = middle
    else right = middle - 1
  }
  return `${chars.slice(0, left).join('')}${TASK_NAME_ELLIPSIS}`
}

function createTaskNameLine(
  text: string,
  style: { fontFamily: string; fontSize: number; fontWeight: string },
): { text: string; width: number } {
  return {
    text,
    width: measureTaskNameText(text, style),
  }
}

let taskNameMeasureCanvas: HTMLCanvasElement | null = null

function measureTaskNameText(
  text: string,
  style: { fontFamily: string; fontSize: number; fontWeight: string },
): number {
  if (typeof document === 'undefined') return Math.ceil(text.length * style.fontSize * 0.6)
  taskNameMeasureCanvas ??= document.createElement('canvas')
  const context = taskNameMeasureCanvas.getContext('2d')
  if (!context) return Math.ceil(text.length * style.fontSize * 0.6)
  context.font = `normal ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
  return Math.ceil(context.measureText(text).width)
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

function normalizeTaskNameText(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Task'
}

export const MODELER_BPMN_TASK_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnTaskViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnTaskViewProps
>(BpmnTaskView as never) as BpmnTaskViewDescriptor
