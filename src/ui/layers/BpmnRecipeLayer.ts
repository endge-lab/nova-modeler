import {
  NovaComponent,
  NovaComponentNode,
  Prop,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaComponentDescriptor,
  type NovaRectBatch,
  type NovaSchema,
  type NovaSurface,
  type NovaTextBatch,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
  type ModelerThemeTokenKey,
} from '@/config/theme.config'
import type {
  ModelerElement,
  ModelerOptions,
  ModelerRect,
  ModelerViewport,
} from '@/domain/types/index'
import { BPMN_GROUP_TYPE } from '@/elements/bpmn/artifacts/group/bpmn-group.factory'
import {
  BPMN_TEXT_ANNOTATION_TYPE,
  normalizeBpmnTextAnnotationBracketSide,
} from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.factory'
import { BPMN_BOUNDARY_EVENT_TYPE } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import { BPMN_DATA_OBJECT_TYPE } from '@/elements/bpmn/data/data-object/bpmn-data-object.factory'
import { BPMN_DATA_STORE_TYPE } from '@/elements/bpmn/data/data-store/bpmn-data-store.factory'
import { BPMN_EVENT_TYPE } from '@/elements/bpmn/event/bpmn-event.factory'
import { BPMN_GATEWAY_TYPE } from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import {
  createBpmnParticipantLayout,
  normalizeBpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import { BPMN_SUB_PROCESS_TYPE } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import { BPMN_TASK_TYPE } from '@/elements/bpmn/task/bpmn-task.factory'

export interface BpmnRecipeLayerViewProps {
  elements: Array<ModelerElement>
  viewport: ModelerViewport
}

export interface BpmnRecipeLayerViewResolvedProps {
  elements: Array<ModelerElement>
  viewport: ModelerViewport
}

export type BpmnRecipeLayerViewDescriptor = NovaComponentDescriptor<
  BpmnRecipeLayerViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnRecipeLayerViewProps
>

const BPMN_RECIPE_NODE_TYPES = new Set([
  BPMN_TASK_TYPE,
  BPMN_SUB_PROCESS_TYPE,
  BPMN_CALL_ACTIVITY_TYPE,
  BPMN_EVENT_TYPE,
  BPMN_BOUNDARY_EVENT_TYPE,
  BPMN_GATEWAY_TYPE,
  BPMN_DATA_OBJECT_TYPE,
  BPMN_DATA_STORE_TYPE,
  BPMN_GROUP_TYPE,
  BPMN_TEXT_ANNOTATION_TYPE,
  'bpmn.participant',
])

export function shouldUseBpmnRecipeRendering(options: ModelerOptions, viewport: ModelerViewport): boolean {
  const recipeOptions = options.rendering?.bpmnRecipes
  if (recipeOptions?.enabled === false) return false
  const lodScale = normalizePositiveNumber(recipeOptions?.lodScale, 0.35)
  return viewport.scale <= lodScale
}

export function isBpmnRecipeRenderableNode(element: ModelerElement): boolean {
  return BPMN_RECIPE_NODE_TYPES.has(element.type)
    && !element.rotation
    && element.width > 0
    && element.height > 0
}

@NovaComponent({
  type: Modeler.BpmnRecipeLayerView,
  name: 'BpmnRecipeLayerView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['viewport'],
    render: ['elements', 'viewport'],
  },
})
export class BpmnRecipeLayerView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnRecipeLayerViewResolvedProps, Record<string, never>, Record<string, never>, BpmnRecipeLayerViewProps, E> {
  @Prop.array<Array<ModelerElement>>({ default: () => [] })
  declare elements: Array<ModelerElement>

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  private readonly fillBatch: NovaRectBatch = createEmptyRectBatch()
  private readonly textBatch: NovaTextBatch = createEmptyTextBatch()
  private revision = 0

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnRecipeLayerViewDescriptor,
    props: BpmnRecipeLayerViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnRecipeLayerViewProps): BpmnRecipeLayerViewResolvedProps {
    return {
      elements: props.elements ?? [],
      viewport: props.viewport,
    }
  }

  update(): void {
    super.update()
    this.options({ width: this.surface.width, height: this.surface.height, interactive: false })
  }

  render(): void {
    super.render()
    const schema: NovaSchema = [] as unknown as NovaSchema
    const textWriter = this.createTextWriter()
    const fillWriter = this.createFillWriter()

    for (const element of this.props.elements) {
      this.appendElementRecipe(schema, fillWriter, textWriter, element)
    }

    this.finalizeFillBatch(fillWriter.count)
    this.finalizeTextBatch(textWriter.count)
    if (this.fillBatch.count > 0) this.renderer.rects(this.fillBatch)
    if (schema.length > 0) this.renderer.schema(schema)
    if (this.textBatch.count > 0) this.renderer.texts(this.textBatch)
  }

  private appendElementRecipe(
    schema: NovaSchema,
    fillWriter: BpmnRecipeFillWriter,
    textWriter: BpmnRecipeTextWriter,
    element: ModelerElement,
  ): void {
    if (element.type === 'bpmn.participant') {
      this.appendParticipantRecipe(schema, element as BpmnParticipantElement)
      return
    }
    if (element.type === BPMN_TASK_TYPE || element.type === BPMN_SUB_PROCESS_TYPE || element.type === BPMN_CALL_ACTIVITY_TYPE) {
      this.appendActivityRecipe(schema, fillWriter, textWriter, element)
      return
    }
    if (element.type === BPMN_EVENT_TYPE || element.type === BPMN_BOUNDARY_EVENT_TYPE) {
      this.appendEventRecipe(schema, element)
      return
    }
    if (element.type === BPMN_GATEWAY_TYPE) {
      this.appendGatewayRecipe(schema, element)
      return
    }
    if (element.type === BPMN_DATA_OBJECT_TYPE) {
      this.appendDataObjectRecipe(schema, textWriter, element)
      return
    }
    if (element.type === BPMN_DATA_STORE_TYPE) {
      this.appendDataStoreRecipe(schema, textWriter, element)
      return
    }
    if (element.type === BPMN_GROUP_TYPE) {
      this.appendGroupRecipe(schema, textWriter, element)
      return
    }
    if (element.type === BPMN_TEXT_ANNOTATION_TYPE) {
      this.appendTextAnnotationRecipe(schema, textWriter, element)
    }
  }

  private appendActivityRecipe(
    schema: NovaSchema,
    fillWriter: BpmnRecipeFillWriter,
    textWriter: BpmnRecipeTextWriter,
    element: ModelerElement,
  ): void {
    const rect = this.elementRectToScreen(element)
    const fill = this.resolveElementFill(element, 'bpmnTaskFill', 'elementFill')
    const stroke = this.resolveElementStroke(element, 'bpmnTaskStroke', 'elementStroke')
    if (!fillWriter.write(rect, fill)) schema.push(createFillRect(rect, fill))
    const borderWidth = this.resolveElementStrokeWidth(element, 'bpmnTaskStrokeWidth', 'elementStrokeWidth')
      * (element.type === BPMN_CALL_ACTIVITY_TYPE ? 1.6 : 1)
    schema.push({
      type: 'rect',
      ...rect,
      styles: {
        background: 'rgba(0,0,0,0)',
        border: {
          color: stroke,
          width: borderWidth,
          radius: 8 * this.props.viewport.scale,
          dashPattern: element.type === BPMN_SUB_PROCESS_TYPE && element.data?.subProcessType === 'event'
            ? [6 * this.props.viewport.scale, 4 * this.props.viewport.scale]
            : undefined,
        },
      },
    })
    if (element.type === BPMN_SUB_PROCESS_TYPE || element.type === BPMN_CALL_ACTIVITY_TYPE) {
      this.appendTinyPlusMarker(schema, rect, stroke)
    }
    const name = typeof element.data?.name === 'string' ? element.data.name : 'Task'
    textWriter.write(name, insetRect(rect, 8 * this.props.viewport.scale, 4 * this.props.viewport.scale))
  }

  private appendEventRecipe(schema: NovaSchema, element: ModelerElement): void {
    const rect = this.elementRectToScreen(element)
    const position = element.type === BPMN_BOUNDARY_EVENT_TYPE ? 'intermediate' : element.data?.eventPosition
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2)
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    const stroke = this.resolveElementStroke(element, 'bpmnEventStroke', 'elementStroke')
    const fill = this.resolveElementFill(element, 'bpmnEventFill', 'elementFill')
    const baseWidth = position === 'end'
      ? 3 * this.props.viewport.scale
      : this.resolveElementStrokeWidth(element, 'bpmnEventStrokeWidth', 'elementStrokeWidth')
    schema.push({
      type: 'circle',
      x: center.x,
      y: center.y,
      radius,
      styles: {
        background: fill,
        border: {
          color: stroke,
          width: baseWidth,
          dashPattern: element.type === BPMN_BOUNDARY_EVENT_TYPE && element.data?.isInterrupting === false
            ? [5 * this.props.viewport.scale, 4 * this.props.viewport.scale]
            : undefined,
        },
      },
    })
    if (position === 'intermediate') {
      schema.push({
        type: 'circle',
        x: center.x,
        y: center.y,
        radius: Math.max(1, radius - 4 * this.props.viewport.scale),
        styles: { background: 'rgba(0,0,0,0)', border: { color: stroke, width: this.props.viewport.scale } },
      })
    }
  }

  private appendGatewayRecipe(schema: NovaSchema, element: ModelerElement): void {
    const rect = this.elementRectToScreen(element)
    const stroke = this.resolveElementStroke(element, 'bpmnGatewayStroke', 'elementStroke')
    const fill = this.resolveElementFill(element, 'bpmnGatewayFill', 'elementFill')
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    schema.push({
      type: 'polygon',
      points: [
        { x: cx, y: rect.y },
        { x: rect.x + rect.width, y: cy },
        { x: cx, y: rect.y + rect.height },
        { x: rect.x, y: cy },
      ],
      styles: {
        background: fill,
        stroke,
        lineWidth: this.resolveElementStrokeWidth(element, 'bpmnGatewayStrokeWidth', 'elementStrokeWidth'),
      },
    })
  }

  private appendDataObjectRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToScreen(element)
    const fold = Math.max(1, rect.width * 0.22)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    const fill = this.resolveElementFill(element, 'elementFill')
    schema.push({
      type: 'polygon',
      points: [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width - fold, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + fold },
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { x: rect.x, y: rect.y + rect.height },
      ],
      styles: { background: fill, stroke, lineWidth: this.resolveElementStrokeWidth(element, 'elementStrokeWidth') },
    })
    const name = typeof element.data?.name === 'string' ? element.data.name : 'Data object'
    textWriter.write(name, {
      x: rect.x,
      y: rect.y + rect.height + 2 * this.props.viewport.scale,
      width: rect.width,
      height: Math.max(1, 22 * this.props.viewport.scale),
    })
  }

  private appendDataStoreRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToScreen(element)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    const fill = this.resolveElementFill(element, 'elementFill')
    schema.push({
      type: 'rect',
      ...rect,
      styles: {
        background: fill,
        border: { color: stroke, width: this.resolveElementStrokeWidth(element, 'elementStrokeWidth'), radius: 8 * this.props.viewport.scale },
      },
    })
    const name = typeof element.data?.name === 'string' ? element.data.name : 'Data store'
    textWriter.write(name, insetRect(rect, 6 * this.props.viewport.scale, 4 * this.props.viewport.scale))
  }

  private appendGroupRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToScreen(element)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    schema.push({
      type: 'rect',
      ...rect,
      styles: {
        background: 'rgba(0,0,0,0)',
        border: {
          color: stroke,
          width: this.resolveElementStrokeWidth(element, 'elementStrokeWidth'),
          radius: 8 * this.props.viewport.scale,
          dashPattern: [6 * this.props.viewport.scale, 4 * this.props.viewport.scale],
        },
      },
    })
    const name = typeof element.data?.name === 'string' ? element.data.name : 'Group'
    textWriter.write(name, {
      x: rect.x + 8 * this.props.viewport.scale,
      y: rect.y + 6 * this.props.viewport.scale,
      width: Math.max(1, rect.width - 16 * this.props.viewport.scale),
      height: Math.max(1, 18 * this.props.viewport.scale),
    })
  }

  private appendTextAnnotationRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToScreen(element)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    const side = normalizeBpmnTextAnnotationBracketSide(element.data?.bracketSide)
    const x = side === 'left' ? rect.x : rect.x + rect.width
    const innerX = side === 'left' ? x + rect.width * 0.12 : x - rect.width * 0.12
    const width = this.resolveElementStrokeWidth(element, 'elementStrokeWidth')
    schema.push({ type: 'line', x1: x, y1: rect.y, x2: x, y2: rect.y + rect.height, styles: { color: stroke, width } })
    schema.push({ type: 'line', x1: x, y1: rect.y, x2: innerX, y2: rect.y, styles: { color: stroke, width } })
    schema.push({ type: 'line', x1: x, y1: rect.y + rect.height, x2: innerX, y2: rect.y + rect.height, styles: { color: stroke, width } })
    const text = typeof element.data?.text === 'string' ? element.data.text : 'Text annotation'
    textWriter.write(text, insetRect(rect, 14 * this.props.viewport.scale, 4 * this.props.viewport.scale))
  }

  private appendParticipantRecipe(schema: NovaSchema, element: BpmnParticipantElement): void {
    const layout = createBpmnParticipantLayout(element)
    const bounds = this.worldRectToScreen(layout.bounds)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    const fill = this.resolveElementFill(element, 'elementFill')
    const lineWidth = this.resolveElementStrokeWidth(element, 'elementStrokeWidth')
    schema.push({
      type: 'rect',
      ...bounds,
      styles: {
        background: fill,
        border: { color: stroke, width: lineWidth, radius: 4 * this.props.viewport.scale },
      },
    })
    const participantHeader = this.worldRectToScreen(layout.participantHeaderRect)
    const laneHeaderArea = this.worldRectToScreen(layout.laneHeaderAreaRect)
    const headerFill = 'rgba(248, 250, 252, 0.66)'
    schema.push({ type: 'rect', ...participantHeader, styles: { background: headerFill } })
    schema.push({ type: 'rect', ...laneHeaderArea, styles: { background: headerFill } })
    const vertical = normalizeBpmnParticipantOrientation(element.data?.orientation) === 'vertical'
    if (vertical) {
      this.appendLine(schema, participantHeader.x, participantHeader.y + participantHeader.height, participantHeader.x + participantHeader.width, participantHeader.y + participantHeader.height, stroke, lineWidth)
      this.appendLine(schema, laneHeaderArea.x, laneHeaderArea.y + laneHeaderArea.height, laneHeaderArea.x + laneHeaderArea.width, laneHeaderArea.y + laneHeaderArea.height, stroke, lineWidth)
    } else {
      this.appendLine(schema, participantHeader.x + participantHeader.width, participantHeader.y, participantHeader.x + participantHeader.width, participantHeader.y + participantHeader.height, stroke, lineWidth)
      this.appendLine(schema, laneHeaderArea.x + laneHeaderArea.width, laneHeaderArea.y, laneHeaderArea.x + laneHeaderArea.width, laneHeaderArea.y + laneHeaderArea.height, stroke, lineWidth)
    }
    layout.lanes.slice(1).forEach(lane => {
      const rect = this.worldRectToScreen(lane.rect)
      if (vertical) this.appendLine(schema, rect.x, rect.y, rect.x, rect.y + rect.height, stroke, lineWidth)
      else this.appendLine(schema, rect.x, rect.y, rect.x + rect.width, rect.y, stroke, lineWidth)
    })
  }

  private appendTinyPlusMarker(schema: NovaSchema, rect: ModelerRect, color: string): void {
    const size = Math.max(1, Math.min(16 * this.props.viewport.scale, rect.height * 0.16))
    const x = rect.x + rect.width / 2
    const y = rect.y + rect.height - size * 1.2
    const width = Math.max(0.5, 1.2 * this.props.viewport.scale)
    schema.push({ type: 'line', x1: x - size / 2, y1: y, x2: x + size / 2, y2: y, styles: { color, width } })
    schema.push({ type: 'line', x1: x, y1: y - size / 2, x2: x, y2: y + size / 2, styles: { color, width } })
  }

  private appendLine(schema: NovaSchema, x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
    schema.push({ type: 'line', x1, y1, x2, y2, styles: { color, width } })
  }

  private elementRectToScreen(element: ModelerElement): ModelerRect {
    return this.worldRectToScreen({
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    })
  }

  private worldRectToScreen(rect: ModelerRect): ModelerRect {
    const viewport = this.props.viewport
    return {
      x: rect.x * viewport.scale + viewport.x,
      y: rect.y * viewport.scale + viewport.y,
      width: rect.width * viewport.scale,
      height: rect.height * viewport.scale,
    }
  }

  private createFillWriter(): BpmnRecipeFillWriter {
    const writer: BpmnRecipeFillWriter = {
      count: 0,
      write: (rect, color) => {
        const rgba = parseCssColor(color)
        if (!rgba) return false
        this.ensureFillCapacity(this.fillBatch, writer.count + 1)
        const index = writer.count
        const x = this.fillBatch.x as Float32Array
        const y = this.fillBatch.y as Float32Array
        const width = this.fillBatch.width as Float32Array
        const height = this.fillBatch.height as Float32Array
        const colors = this.fillBatch.colors as Float32Array
        x[index] = rect.x
        y[index] = rect.y
        width[index] = rect.width
        height[index] = rect.height
        colors[index * 4] = rgba[0]
        colors[index * 4 + 1] = rgba[1]
        colors[index * 4 + 2] = rgba[2]
        colors[index * 4 + 3] = rgba[3]
        writer.count += 1
        return true
      },
    }
    return writer
  }

  private createTextWriter(): BpmnRecipeTextWriter {
    const writer: BpmnRecipeTextWriter = {
      count: 0,
      write: (text, rect) => {
        if (text.trim().length === 0 || rect.width <= 1 || rect.height <= 1) return
        this.ensureTextCapacity(this.textBatch, writer.count + 1)
        const index = writer.count
        const x = this.textBatch.x as Float32Array
        const y = this.textBatch.y as Float32Array
        const width = this.textBatch.width as Float32Array
        const height = this.textBatch.height as Float32Array
        ;(this.textBatch.text as Array<string>)[index] = text
        x[index] = rect.x
        y[index] = rect.y
        width[index] = rect.width
        height[index] = rect.height
        writer.count += 1
      },
    }
    return writer
  }

  private finalizeFillBatch(count: number): void {
    this.fillBatch.count = count
    this.fillBatch.revision = this.revision
    this.fillBatch.staticRevision = this.revision
  }

  private finalizeTextBatch(count: number): void {
    this.textBatch.count = count
    this.textBatch.revision = this.revision
    this.textBatch.staticRevision = this.revision
    this.textBatch.color = this.resolveThemeColor('bpmnTaskTextColor')
    this.textBatch.font = {
      family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      size: Math.max(1, 12 * this.props.viewport.scale),
      weight: '500',
    }
    this.textBatch.align = { horizontal: 'center', vertical: 'middle' }
    this.textBatch.lineHeight = Math.max(1, 16 * this.props.viewport.scale)
    this.textBatch.ellipsis = true
    this.revision += 1
  }

  private ensureFillCapacity(batch: NovaRectBatch, capacity: number): void {
    if (batch.x.length >= capacity) return
    const nextCapacity = growCapacity(batch.x.length, capacity)
    batch.x = copyFloat32(batch.x, nextCapacity)
    batch.y = copyFloat32(batch.y, nextCapacity)
    batch.width = copyFloat32(batch.width, nextCapacity)
    batch.height = copyFloat32(batch.height, nextCapacity)
    batch.colors = copyFloat32(batch.colors, nextCapacity * 4)
  }

  private ensureTextCapacity(batch: NovaTextBatch, capacity: number): void {
    if (batch.x.length >= capacity) return
    const nextCapacity = growCapacity(batch.x.length, capacity)
    batch.x = copyFloat32(batch.x, nextCapacity)
    batch.y = copyFloat32(batch.y, nextCapacity)
    batch.width = copyFloat32(batch.width, nextCapacity)
    batch.height = copyFloat32(batch.height, nextCapacity)
    const nextText = new Array<string>(nextCapacity)
    for (let index = 0; index < (batch.text as Array<string>).length; index += 1) nextText[index] = batch.text[index] ?? ''
    batch.text = nextText
  }

  private resolveElementFill(element: ModelerElement, token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): string {
    return String(element.style?.fill ?? this.resolveThemeColor(token, fallbackToken))
  }

  private resolveElementStroke(element: ModelerElement, token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): string {
    return String(element.style?.stroke ?? this.resolveThemeColor(token, fallbackToken))
  }

  private resolveElementStrokeWidth(element: ModelerElement, token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): number {
    const value = Number(element.style?.strokeWidth ?? this.resolveThemeNumber(token, fallbackToken))
    const normalized = Number.isFinite(value) && value > 0 ? value : this.resolveThemeNumber(token, fallbackToken)
    return Math.max(0.5, normalized * this.props.viewport.scale)
  }

  private resolveThemeColor(token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): string {
    const fallback = String(MODELER_THEME_FALLBACKS[fallbackToken ?? token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }

  private resolveThemeNumber(token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): number {
    const fallback = Number(MODELER_THEME_FALLBACKS[fallbackToken ?? token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
}

interface BpmnRecipeFillWriter {
  count: number
  write(rect: ModelerRect, color: string): boolean
}

interface BpmnRecipeTextWriter {
  count: number
  write(text: string, rect: ModelerRect): void
}

function createEmptyRectBatch(): NovaRectBatch {
  return {
    count: 0,
    x: new Float32Array(0),
    y: new Float32Array(0),
    width: new Float32Array(0),
    height: new Float32Array(0),
    colors: new Float32Array(0),
    revision: 0,
    staticRevision: 0,
  }
}

function createEmptyTextBatch(): NovaTextBatch {
  return {
    count: 0,
    text: [],
    x: new Float32Array(0),
    y: new Float32Array(0),
    width: new Float32Array(0),
    height: new Float32Array(0),
    revision: 0,
    staticRevision: 0,
  }
}

function createFillRect(rect: ModelerRect, color: string): NovaSchema[number] {
  return {
    type: 'rect',
    ...rect,
    styles: { background: color },
  }
}

function insetRect(rect: ModelerRect, x: number, y: number): ModelerRect {
  return {
    x: rect.x + x,
    y: rect.y + y,
    width: Math.max(1, rect.width - x * 2),
    height: Math.max(1, rect.height - y * 2),
  }
}

function growCapacity(current: number, required: number): number {
  let next = Math.max(16, current)
  while (next < required) next *= 2
  return next
}

function copyFloat32(source: ArrayLike<number>, capacity: number): Float32Array {
  const next = new Float32Array(capacity)
  for (let index = 0; index < source.length; index += 1) next[index] = source[index] ?? 0
  return next
}

function parseCssColor(color: string): [number, number, number, number] | null {
  const value = color.trim()
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (hex) {
    const raw = hex[1]!
    const expanded = raw.length === 3
      ? raw.split('').map(char => `${char}${char}`).join('')
      : raw
    const r = Number.parseInt(expanded.slice(0, 2), 16) / 255
    const g = Number.parseInt(expanded.slice(2, 4), 16) / 255
    const b = Number.parseInt(expanded.slice(4, 6), 16) / 255
    const a = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1
    return [r, g, b, a]
  }
  const rgba = value.match(/^rgba?\(([^)]+)\)$/i)
  if (!rgba) return null
  const parts = rgba[1]!.split(',').map(part => Number(part.trim()))
  if (parts.length < 3 || parts.some(part => !Number.isFinite(part))) return null
  return [
    clamp01(parts[0]! / 255),
    clamp01(parts[1]! / 255),
    clamp01(parts[2]! / 255),
    clamp01(parts[3] ?? 1),
  ]
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export const MODELER_BPMN_RECIPE_LAYER_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnRecipeLayerViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnRecipeLayerViewProps
>(BpmnRecipeLayerView as never) as BpmnRecipeLayerViewDescriptor
