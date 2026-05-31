import type {
  ModelerEdgeElement,
  ModelerElement,
  ModelerExportContext,
  ModelerPngExportOptions,
  ModelerPoint,
  ModelerRect,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { BASIC_RECT_TYPE } from '@/elements/basic/rect/basic-rect.factory'
import { BPMN_EVENT_TYPE } from '@/elements/bpmn/event/bpmn-event.factory'
import { BPMN_FLOW_TYPE, normalizeBpmnFlowType } from '@/elements/bpmn/flow/bpmn-flow.factory'
import type { BpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.types'
import { BPMN_GATEWAY_TYPE, normalizeBpmnGatewayType } from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import type { BpmnGatewayElement } from '@/elements/bpmn/gateway/bpmn-gateway.types'
import { BPMN_TASK_TYPE } from '@/elements/bpmn/task/bpmn-task.factory'
import type { BpmnTaskElement } from '@/elements/bpmn/task/bpmn-task.types'
import { ModelerExportGeometry } from '@/model/export/modeler-export-geometry'

const DEFAULT_PADDING = 24
const DEFAULT_BACKGROUND = '#ffffff'
const PNG_MIME_TYPE = 'image/png'

/**
 * Рисует модель на белый tight canvas и отдает PNG Blob.
 */
export class ModelerPngExporter {
  private readonly geometry = new ModelerExportGeometry()

  /**
   * Создает PNG Blob только с элементами модели.
   */
  async export(context: ModelerExportContext, options: ModelerPngExportOptions = {}): Promise<Blob> {
    const padding = Math.max(0, options.padding ?? DEFAULT_PADDING)
    const scale = Math.max(0.1, options.scale ?? 1)
    const bounds = this.geometry.resolveContentBounds(context.model, context.pluginContext)
    const width = Math.max(1, Math.ceil((bounds.width + padding * 2) * scale))
    const height = Math.max(1, Math.ceil((bounds.height + padding * 2) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('[ModelerPngExporter] Canvas 2D context is unavailable.')
    ctx.save()
    ctx.fillStyle = options.background ?? DEFAULT_BACKGROUND
    ctx.fillRect(0, 0, width, height)
    ctx.scale(scale, scale)
    ctx.translate(padding - bounds.x, padding - bounds.y)
    this.renderElements(ctx, context, bounds)
    ctx.restore()
    return canvasToBlob(canvas, PNG_MIME_TYPE)
  }

  private renderElements(ctx: CanvasRenderingContext2D, context: ModelerExportContext, bounds: ModelerRect): void {
    const ordered = [...context.model.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    for (const element of ordered) {
      if (isModelerEdgeElement(element)) this.renderEdge(ctx, context, element)
    }
    for (const element of ordered) {
      if (!isModelerEdgeElement(element)) this.renderNode(ctx, element, bounds)
    }
  }

  private renderNode(ctx: CanvasRenderingContext2D, element: ModelerElement, bounds: ModelerRect): void {
    if (element.type === BPMN_TASK_TYPE) {
      this.renderTask(ctx, element as BpmnTaskElement, bounds)
      return
    }
    if (element.type === BPMN_EVENT_TYPE) {
      this.renderEvent(ctx, element)
      return
    }
    if (element.type === BPMN_GATEWAY_TYPE) {
      this.renderGateway(ctx, element as BpmnGatewayElement)
      return
    }
    if (element.type === BASIC_RECT_TYPE) {
      this.renderRect(ctx, element)
    }
  }

  private renderTask(ctx: CanvasRenderingContext2D, element: BpmnTaskElement, bounds: ModelerRect): void {
    this.renderRect(ctx, element, 8)
    const name = String(element.data?.name ?? '')
    if (!name) return
    ctx.save()
    ctx.fillStyle = '#111827'
    ctx.font = '600 13px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = wrapText(ctx, name, Math.max(1, element.width - 20), 3)
    const lineHeight = 16
    const firstY = element.y + element.height / 2 - (lines.length - 1) * lineHeight / 2
    lines.forEach((line, index) => {
      ctx.fillText(line, element.x + element.width / 2, firstY + index * lineHeight)
    })
    ctx.restore()
    void bounds
  }

  private renderRect(ctx: CanvasRenderingContext2D, element: ModelerElement, radius = Number(element.style?.radius ?? 6)): void {
    ctx.save()
    ctx.fillStyle = String(element.style?.fill ?? '#ffffff')
    ctx.strokeStyle = String(element.style?.stroke ?? '#111827')
    ctx.lineWidth = Number(element.style?.strokeWidth ?? 2)
    roundedRect(ctx, element.x, element.y, element.width, element.height, radius)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  private renderEvent(ctx: CanvasRenderingContext2D, element: ModelerElement): void {
    ctx.save()
    ctx.fillStyle = String(element.style?.fill ?? '#ffffff')
    ctx.strokeStyle = String(element.style?.stroke ?? '#111827')
    ctx.lineWidth = Number(element.style?.strokeWidth ?? 2)
    const cx = element.x + element.width / 2
    const cy = element.y + element.height / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, element.width / 2, element.height / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    if (element.data?.eventPosition === 'end') {
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(cx, cy, element.width / 2 - 3, element.height / 2 - 3, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  private renderGateway(ctx: CanvasRenderingContext2D, element: BpmnGatewayElement): void {
    const cx = element.x + element.width / 2
    const cy = element.y + element.height / 2
    ctx.save()
    ctx.fillStyle = String(element.style?.fill ?? '#ffffff')
    ctx.strokeStyle = String(element.style?.stroke ?? '#111827')
    ctx.lineWidth = Number(element.style?.strokeWidth ?? 2)
    ctx.beginPath()
    ctx.moveTo(cx, element.y)
    ctx.lineTo(element.x + element.width, cy)
    ctx.lineTo(cx, element.y + element.height)
    ctx.lineTo(element.x, cy)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    this.renderGatewayMarker(ctx, element, cx, cy)
    ctx.restore()
  }

  private renderGatewayMarker(ctx: CanvasRenderingContext2D, element: BpmnGatewayElement, cx: number, cy: number): void {
    const type = normalizeBpmnGatewayType(element.data?.gatewayType)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 3
    if (type === 'parallel') {
      ctx.beginPath()
      ctx.moveTo(cx - 10, cy)
      ctx.lineTo(cx + 10, cy)
      ctx.moveTo(cx, cy - 10)
      ctx.lineTo(cx, cy + 10)
      ctx.stroke()
      return
    }
    if (type === 'inclusive') {
      ctx.beginPath()
      ctx.arc(cx, cy, 10, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  private renderEdge(ctx: CanvasRenderingContext2D, context: ModelerExportContext, element: ModelerEdgeElement): void {
    if (element.type !== BPMN_FLOW_TYPE) return
    const path = this.geometry.resolveEdgePath(context.model, element, context.pluginContext)
    if (path.length < 2) return
    ctx.save()
    ctx.strokeStyle = String(element.style?.stroke ?? '#111827')
    ctx.fillStyle = String(element.style?.stroke ?? '#111827')
    ctx.lineWidth = Number(element.style?.strokeWidth ?? 2)
    if (normalizeBpmnFlowType((element as BpmnFlowElement).data?.flowType) === 'conditionalSequence') {
      ctx.setLineDash([6, 4])
    }
    ctx.beginPath()
    ctx.moveTo(path[0]!.x, path[0]!.y)
    for (const point of path.slice(1)) ctx.lineTo(point.x, point.y)
    ctx.stroke()
    ctx.setLineDash([])
    this.renderArrow(ctx, path[path.length - 2]!, path[path.length - 1]!)
    ctx.restore()
  }

  private renderArrow(ctx: CanvasRenderingContext2D, from: ModelerPoint, to: ModelerPoint): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const size = 9
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fill()
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): Array<string> {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: Array<string> = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
    if (lines.length >= maxLines - 1) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (lines.length === 0) lines.push(text)
  return lines
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('[ModelerPngExporter] Canvas did not produce a Blob.'))
      }, mimeType)
    })
  }
  const dataUrl = canvas.toDataURL(mimeType)
  const binary = atob(dataUrl.split(',')[1] ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return Promise.resolve(new Blob([bytes], { type: mimeType }))
}
