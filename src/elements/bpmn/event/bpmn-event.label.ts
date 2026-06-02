export interface BpmnEventNameLayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BpmnEventNameLayoutLine {
  text: string
  x: number
  y: number
  width: number
  widthLimit: number
  height: number
}

export interface BpmnEventNameLayout {
  text: string
  rect: BpmnEventNameLayoutRect
  lines: Array<BpmnEventNameLayoutLine>
  clipped: boolean
  fontFamily: string
  fontSize: number
  fontWeight: '500'
  lineHeight: number
}

const EVENT_NAME_FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const EVENT_NAME_FONT_WEIGHT = '500' as const
const EVENT_NAME_GAP = 8
const EVENT_NAME_MIN_WIDTH = 72
const EVENT_NAME_WIDTH_FACTOR = 2.6
const EVENT_NAME_MAX_LINES = 2
const EVENT_NAME_ELLIPSIS = '...'

export function resolveBpmnEventNameLayout(input: {
  name?: string
  width: number
  height: number
}): BpmnEventNameLayout {
  const text = normalizeBpmnEventNameText(input.name)
  const width = Math.max(0, input.width)
  const height = Math.max(0, input.height)
  const fontSize = resolveBpmnEventNameFontSize(width, height)
  const lineHeight = resolveBpmnEventNameLineHeight(fontSize)
  const labelWidth = Math.max(EVENT_NAME_MIN_WIDTH, width * EVENT_NAME_WIDTH_FACTOR)
  const rect: BpmnEventNameLayoutRect = {
    x: -labelWidth / 2,
    y: height / 2 + EVENT_NAME_GAP,
    width: labelWidth,
    height: lineHeight * EVENT_NAME_MAX_LINES,
  }
  const sourceLines = text
    ? buildEventNameSourceLines(text, rect.width, { fontSize }, EVENT_NAME_MAX_LINES + 1)
    : []
  const visibleLines = sourceLines.slice(0, EVENT_NAME_MAX_LINES)
  const clipped = sourceLines.length > EVENT_NAME_MAX_LINES || visibleLines.some(line => line.width > rect.width)

  if (clipped && visibleLines.length > 0) {
    const lastIndex = visibleLines.length - 1
    visibleLines[lastIndex] = createEventNameLine(
      fitEventNameWithEllipsis(visibleLines[lastIndex]?.text ?? '', rect.width, { fontSize }),
      { fontSize },
    )
  }

  return {
    text,
    rect,
    lines: visibleLines.map((line, index) => ({
      text: line.text,
      x: rect.x,
      y: rect.y + index * lineHeight,
      width: line.width,
      widthLimit: rect.width,
      height: lineHeight,
    })),
    clipped,
    fontFamily: EVENT_NAME_FONT_FAMILY,
    fontSize,
    fontWeight: EVENT_NAME_FONT_WEIGHT,
    lineHeight,
  }
}

export function containsBpmnEventNameLayoutPoint(layout: BpmnEventNameLayout, point: { x: number; y: number }): boolean {
  return layout.text.length > 0
    && point.x >= layout.rect.x
    && point.x <= layout.rect.x + layout.rect.width
    && point.y >= layout.rect.y
    && point.y <= layout.rect.y + layout.rect.height
}

function normalizeBpmnEventNameText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveBpmnEventNameFontSize(width: number, height: number): number {
  return Math.max(8, Math.min(12, Math.min(width, height) * 0.25))
}

function resolveBpmnEventNameLineHeight(fontSize: number): number {
  return Math.max(10, fontSize + 4)
}

function buildEventNameSourceLines(
  text: string,
  width: number,
  style: { fontSize: number },
  limit: number,
): Array<{ text: string; width: number }> {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: Array<{ text: string; width: number }> = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && measureEventNameText(next, style) > width) {
      lines.push(createEventNameLine(current, style))
      current = word
      if (lines.length >= limit) break
      continue
    }
    current = next
  }
  if (current && lines.length < limit) lines.push(createEventNameLine(current, style))
  if (lines.length === 0 && text) lines.push(createEventNameLine(text, style))
  return lines
}

function createEventNameLine(text: string, style: { fontSize: number }): { text: string; width: number } {
  return { text, width: measureEventNameText(text, style) }
}

function fitEventNameWithEllipsis(text: string, width: number, style: { fontSize: number }): string {
  if (measureEventNameText(text, style) <= width) return text
  let next = text
  while (next.length > 0 && measureEventNameText(`${next}${EVENT_NAME_ELLIPSIS}`, style) > width) {
    next = next.slice(0, -1).trimEnd()
  }
  return next ? `${next}${EVENT_NAME_ELLIPSIS}` : EVENT_NAME_ELLIPSIS
}

function measureEventNameText(text: string, style: { fontSize: number }): number {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (context) {
      context.font = `${EVENT_NAME_FONT_WEIGHT} ${style.fontSize}px ${EVENT_NAME_FONT_FAMILY}`
      return context.measureText(text).width
    }
  }
  return text.length * style.fontSize * 0.56
}
