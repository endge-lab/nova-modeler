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
  ModelerBpmnRecipeRenderingOptions,
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
import {
  BPMN_EVENT_TYPE,
  defaultBpmnEventDirection,
  normalizeBpmnEventDirection,
  normalizeBpmnEventPosition,
  normalizeBpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.factory'
import { resolveBpmnEventNameLayout } from '@/elements/bpmn/event/bpmn-event.label'
import type {
  BpmnEventDirection,
  BpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.types'
import {
  BPMN_GATEWAY_TYPE,
  normalizeBpmnGatewayType,
} from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import { resolveBpmnGatewayNameLayout } from '@/elements/bpmn/gateway/bpmn-gateway.label'
import type { BpmnGatewayType } from '@/elements/bpmn/gateway/bpmn-gateway.types'
import {
  areBpmnParticipantLaneHeadersVisible,
  createBpmnParticipantLayout,
  normalizeBpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import { BPMN_SUB_PROCESS_TYPE } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import { BPMN_TASK_TYPE } from '@/elements/bpmn/task/bpmn-task.factory'
import type { BpmnTaskElementData } from '@/elements/bpmn/task/bpmn-task.types'
import { resolveBpmnActivityNameLayout } from '@/ui/elements/bpmn/activity/BpmnActivityView'
import { resolveBpmnTaskNameLayout } from '@/ui/elements/bpmn/task/BpmnTaskView'

export interface BpmnRecipeLayerViewProps {
  elements: Array<ModelerElement>
  viewport: ModelerViewport
  textMode?: ModelerBpmnRecipeRenderingOptions['text']
  visibleElements?: number
  culledElements?: number
  schemaFallbacks?: number
}

export interface BpmnRecipeLayerViewResolvedProps {
  elements: Array<ModelerElement>
  viewport: ModelerViewport
  textMode: NonNullable<ModelerBpmnRecipeRenderingOptions['text']>
  visibleElements: number
  culledElements: number
  schemaFallbacks: number
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

export function normalizeBpmnRecipeRenderingOptions(options?: ModelerOptions): Required<ModelerBpmnRecipeRenderingOptions> {
  const recipeOptions = options?.rendering?.bpmnRecipes
  return {
    enabled: recipeOptions?.enabled !== false,
    mode: recipeOptions?.mode ?? 'auto',
    lodScale: normalizePositiveNumber(recipeOptions?.lodScale, 0.35),
    nodes: recipeOptions?.nodes !== false,
    edges: recipeOptions?.edges === true,
    text: recipeOptions?.text ?? 'batch',
    culling: recipeOptions?.culling !== false,
    diagnostics: recipeOptions?.diagnostics === true,
  }
}

export function shouldUseBpmnRecipeRendering(options: ModelerOptions, viewport: ModelerViewport): boolean {
  const recipeOptions = normalizeBpmnRecipeRenderingOptions(options)
  if (!recipeOptions.enabled || !recipeOptions.nodes || recipeOptions.mode === 'off') return false
  if (recipeOptions.mode === 'lod') return viewport.scale <= recipeOptions.lodScale
  return true
}

export function isBpmnRecipeNodeType(type: string): boolean {
  return BPMN_RECIPE_NODE_TYPES.has(type)
}

export function isBpmnRecipeRenderableNode(element: ModelerElement): boolean {
  return isBpmnRecipeNodeType(element.type)
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
    render: ['elements', 'textMode', 'visibleElements', 'culledElements', 'schemaFallbacks'],
  },
})
export class BpmnRecipeLayerView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnRecipeLayerViewResolvedProps, Record<string, never>, Record<string, never>, BpmnRecipeLayerViewProps, E> {
  @Prop.array<Array<ModelerElement>>({ default: () => [] })
  declare elements: Array<ModelerElement>

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  @Prop.string<'batch' | 'schema' | 'hide-small'>({ default: 'batch' })
  declare textMode: NonNullable<ModelerBpmnRecipeRenderingOptions['text']>

  @Prop.number({ default: 0 })
  declare visibleElements: number

  @Prop.number({ default: 0 })
  declare culledElements: number

  @Prop.number({ default: 0 })
  declare schemaFallbacks: number

  private readonly batchRuntime = new BpmnBatchRuntime()

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
      textMode: props.textMode ?? 'batch',
      visibleElements: props.visibleElements ?? props.elements?.length ?? 0,
      culledElements: props.culledElements ?? 0,
      schemaFallbacks: props.schemaFallbacks ?? 0,
    }
  }

  update(): void {
    super.update()
    const scale = normalizePositiveNumber(this.props.viewport.scale, 1)
    this.options({
      x: this.props.viewport.x,
      y: this.props.viewport.y,
      scaleX: scale,
      scaleY: scale,
      width: Math.ceil(this.surface.width / scale),
      height: Math.ceil(this.surface.height / scale),
      interactive: false,
    })
  }

  render(): void {
    super.render()
    const schema: NovaSchema = [] as unknown as NovaSchema
    const writers = this.batchRuntime.begin()
    const textWriter = this.createTextWriter(schema, writers.text)

    for (const element of this.props.elements) {
      this.appendElementRecipe(schema, writers.fill, textWriter, element)
    }

    this.batchRuntime.finalize({
      recipeElements: this.props.elements.length,
      visibleElements: this.props.visibleElements,
      culledElements: this.props.culledElements,
      schemaFallbacks: this.props.schemaFallbacks,
      schemaItems: schema.length,
      textEnabled: this.props.textMode === 'batch',
      textColor: this.resolveThemeColor('bpmnTaskTextColor'),
    })
    const fillBatch = this.batchRuntime.getFillBatch()
    const textBatch = this.batchRuntime.getTextBatch()
    if (fillBatch.count > 0) this.renderer.rects(fillBatch)
    if (schema.length > 0) this.renderer.schema(schema)
    if (textBatch.count > 0) this.renderer.texts(textBatch)
  }

  private createTextWriter(schema: NovaSchema, batchWriter: BpmnRecipeTextWriter): BpmnRecipeTextWriter {
    if (this.props.textMode === 'batch') return batchWriter
    if (this.props.textMode === 'hide-small') {
      return { write: () => undefined }
    }
    return {
      write: (_elementId, _slotId, text, rect) => {
        if (text.trim().length === 0 || rect.width <= 1 || rect.height <= 1) return
        schema.push({
          type: 'text',
          text,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          clip: true,
          styles: {
            color: this.resolveThemeColor('bpmnTaskTextColor'),
            font: {
              family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              size: 12,
              weight: '500',
            },
            lineHeight: 16,
          },
        })
      },
    }
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
      this.appendEventRecipe(schema, textWriter, element)
      return
    }
    if (element.type === BPMN_GATEWAY_TYPE) {
      this.appendGatewayRecipe(schema, textWriter, element)
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
    const rect = this.elementRectToWorld(element)
    const fill = this.resolveElementFill(element, 'bpmnTaskFill', 'elementFill')
    const stroke = this.resolveElementStroke(element, 'bpmnTaskStroke', 'elementStroke')
    const radius = this.resolveElementRadius(element, 'bpmnTaskRadius')
    if (!fillWriter.write(element.id, 'activity-fill', rect, fill, radius)) schema.push(createFillRect(rect, fill, radius))
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
          radius,
          dashPattern: element.type === BPMN_SUB_PROCESS_TYPE && element.data?.subProcessType === 'event'
            ? [6, 4]
            : undefined,
        },
      },
    })
    if (element.type === BPMN_SUB_PROCESS_TYPE || element.type === BPMN_CALL_ACTIVITY_TYPE) {
      this.appendTinyPlusMarker(schema, rect, stroke)
    }
    this.appendActivityLabel(textWriter, element, rect)
  }

  private appendActivityLabel(textWriter: BpmnRecipeTextWriter, element: ModelerElement, rect: ModelerRect): void {
    const name = typeof element.data?.name === 'string' ? element.data.name : 'Task'
    const data = element.data as Partial<BpmnTaskElementData> | undefined
    const layout = element.type === BPMN_TASK_TYPE
      ? resolveBpmnTaskNameLayout({
          name,
          width: rect.width,
          height: rect.height,
          data,
        })
      : resolveBpmnActivityNameLayout({
          name,
          width: rect.width,
          height: rect.height,
          data,
        })
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    }
    layout.lines.forEach((line, index) => {
      textWriter.write(element.id, `activity-label:${index}`, line.text, {
        x: center.x + line.x,
        y: center.y + line.y,
        width: line.widthLimit,
        height: line.height,
      })
    })
  }

  private appendEventRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToWorld(element)
    const position = element.type === BPMN_BOUNDARY_EVENT_TYPE ? 'intermediate' : element.data?.eventPosition
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2)
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    const stroke = this.resolveElementStroke(element, 'bpmnEventStroke', 'elementStroke')
    const fill = this.resolveElementFill(element, 'bpmnEventFill', 'elementFill')
    const baseWidth = position === 'end'
      ? 3
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
            ? [5, 4]
            : undefined,
        },
      },
    })
    if (position === 'intermediate') {
      schema.push({
        type: 'circle',
        x: center.x,
        y: center.y,
        radius: Math.max(1, radius - 4),
        styles: { background: 'rgba(0,0,0,0)', border: { color: stroke, width: 1 } },
      })
    }
    this.appendEventTriggerMarker(schema, element, center, Math.min(rect.width, rect.height) * 0.48)
    if (element.type === BPMN_EVENT_TYPE) {
      if (this.appendExternalGeometryLabel(textWriter, element, 'event-label', center)) return
      const layout = resolveBpmnEventNameLayout({
        name: element.data?.name as string | undefined,
        width: rect.width,
        height: rect.height,
      })
      layout.lines.forEach((line, index) => {
        textWriter.write(element.id, `event-label:${index}`, line.text, {
          x: center.x + line.x,
          y: center.y + line.y,
          width: line.widthLimit,
          height: line.height,
        })
      })
    }
  }

  private appendEventTriggerMarker(schema: NovaSchema, element: ModelerElement, center: { x: number; y: number }, size: number): void {
    const data = element.data ?? {}
    const trigger = normalizeBpmnEventTrigger(data.trigger)
    if (trigger === 'none') return
    const position = normalizeBpmnEventPosition(data.eventPosition)
    const direction = normalizeBpmnEventDirection(data.direction, defaultBpmnEventDirection(position))
    const color = String(element.style?.markerColor ?? this.resolveThemeColor('bpmnEventStroke', 'elementStroke'))
    const filled = trigger === 'terminate' || direction === 'throw'
    this.appendEventMarkerByTrigger(schema, trigger, direction, center, Math.max(1, size), color, filled)
  }

  private appendEventMarkerByTrigger(
    schema: NovaSchema,
    trigger: BpmnEventTrigger,
    direction: BpmnEventDirection,
    center: { x: number; y: number },
    size: number,
    color: string,
    filled: boolean,
  ): void {
    if (trigger === 'message') {
      this.appendMessageMarker(schema, center, size, color, filled)
      return
    }
    if (trigger === 'timer') {
      this.appendTimerMarker(schema, center, size, color, filled)
      return
    }
    if (trigger === 'error') {
      this.appendErrorMarker(schema, center, size, color, filled)
      return
    }
    if (trigger === 'escalation' || trigger === 'signal') {
      this.appendTriangleMarker(schema, center, size, color, filled)
      return
    }
    if (trigger === 'cancel') {
      this.appendCancelMarker(schema, center, size, color, filled)
      return
    }
    if (trigger === 'compensation') {
      this.appendCompensationMarker(schema, center, size, color, filled)
      return
    }
    if (trigger === 'conditional') {
      this.appendConditionalMarker(schema, center, size, color, filled)
      return
    }
    if (trigger === 'link') {
      this.appendLinkMarker(schema, center, size, color, filled)
      return
    }
    if (trigger === 'terminate') {
      this.appendCircleMarker(schema, center, size * 0.34, color, true)
      return
    }
    if (trigger === 'parallelMultiple') {
      this.appendParallelMultipleMarker(schema, center, size, color, filled)
      return
    }
    this.appendMultipleMarker(schema, center, size, color, filled || direction === 'throw')
  }

  private appendMessageMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    const width = size * 0.78
    const height = size * 0.48
    const x = center.x - width / 2
    const y = center.y - height / 2
    this.appendRectMarker(schema, x, y, width, height, color, filled)
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: x, y1: y, x2: center.x, y2: y + height * 0.56, styles: { color: lineColor, width: 1.6 } })
    schema.push({ type: 'line', x1: x + width, y1: y, x2: center.x, y2: y + height * 0.56, styles: { color: lineColor, width: 1.6 } })
  }

  private appendTimerMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    const radius = size * 0.32
    this.appendCircleMarker(schema, center, radius, color, filled)
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: center.x, y1: center.y, x2: center.x, y2: center.y - radius * 0.55, styles: { color: lineColor, width: 1.6 } })
    schema.push({ type: 'line', x1: center.x, y1: center.y, x2: center.x + radius * 0.42, y2: center.y + radius * 0.2, styles: { color: lineColor, width: 1.6 } })
  }

  private appendErrorMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    this.appendPolygonMarker(schema, center, [
      { x: -size * 0.12, y: -size * 0.42 },
      { x: size * 0.2, y: -size * 0.06 },
      { x: size * 0.04, y: -size * 0.06 },
      { x: size * 0.22, y: size * 0.42 },
      { x: -size * 0.22, y: size * 0.02 },
      { x: -size * 0.04, y: size * 0.02 },
    ], color, filled)
  }

  private appendTriangleMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    this.appendPolygonMarker(schema, center, [
      { x: 0, y: -size * 0.4 },
      { x: size * 0.4, y: size * 0.32 },
      { x: -size * 0.4, y: size * 0.32 },
    ], color, filled)
  }

  private appendCancelMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    const lineWidth = filled ? 2.4 : 2
    if (filled) this.appendCircleMarker(schema, center, size * 0.36, color, true)
    const lineColor = filled ? '#ffffff' : color
    schema.push({ type: 'line', x1: center.x - size * 0.24, y1: center.y - size * 0.24, x2: center.x + size * 0.24, y2: center.y + size * 0.24, styles: { color: lineColor, width: lineWidth } })
    schema.push({ type: 'line', x1: center.x + size * 0.24, y1: center.y - size * 0.24, x2: center.x - size * 0.24, y2: center.y + size * 0.24, styles: { color: lineColor, width: lineWidth } })
  }

  private appendCompensationMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    const pointsA = [
      { x: -size * 0.38, y: 0 },
      { x: -size * 0.04, y: -size * 0.3 },
      { x: -size * 0.04, y: size * 0.3 },
    ]
    const pointsB = pointsA.map(point => ({ x: point.x + size * 0.34, y: point.y }))
    this.appendPolygonMarker(schema, center, pointsA, color, filled)
    this.appendPolygonMarker(schema, center, pointsB, color, filled)
  }

  private appendConditionalMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    const width = size * 0.58
    const height = size * 0.7
    const x = center.x - width / 2
    const y = center.y - height / 2
    this.appendRectMarker(schema, x, y, width, height, color, filled)
    const lineColor = filled ? '#ffffff' : color
    for (let index = 0; index < 3; index += 1) {
      const lineY = y + height * (0.28 + index * 0.22)
      schema.push({ type: 'line', x1: x + width * 0.22, y1: lineY, x2: x + width * 0.78, y2: lineY, styles: { color: lineColor, width: 1.4 } })
    }
  }

  private appendLinkMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    this.appendPolygonMarker(schema, center, [
      { x: -size * 0.42, y: -size * 0.22 },
      { x: size * 0.06, y: -size * 0.22 },
      { x: size * 0.06, y: -size * 0.38 },
      { x: size * 0.42, y: 0 },
      { x: size * 0.06, y: size * 0.38 },
      { x: size * 0.06, y: size * 0.22 },
      { x: -size * 0.42, y: size * 0.22 },
    ], color, filled)
  }

  private appendParallelMultipleMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    if (filled) this.appendCircleMarker(schema, center, size * 0.36, color, true)
    const lineColor = filled ? '#ffffff' : color
    const width = filled ? 2.4 : 2
    schema.push({ type: 'line', x1: center.x - size * 0.3, y1: center.y, x2: center.x + size * 0.3, y2: center.y, styles: { color: lineColor, width } })
    schema.push({ type: 'line', x1: center.x, y1: center.y - size * 0.3, x2: center.x, y2: center.y + size * 0.3, styles: { color: lineColor, width } })
  }

  private appendMultipleMarker(schema: NovaSchema, center: { x: number; y: number }, size: number, color: string, filled: boolean): void {
    const points = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / 5)
      return {
        x: Math.cos(angle) * size * 0.36,
        y: Math.sin(angle) * size * 0.36,
      }
    })
    this.appendPolygonMarker(schema, center, points, color, filled)
  }

  private appendCircleMarker(schema: NovaSchema, center: { x: number; y: number }, radius: number, color: string, filled: boolean): void {
    schema.push({
      type: 'circle',
      x: center.x,
      y: center.y,
      radius,
      styles: {
        background: filled ? color : 'rgba(0,0,0,0)',
        border: { color, width: 2 },
      },
    })
  }

  private appendRectMarker(schema: NovaSchema, x: number, y: number, width: number, height: number, color: string, filled: boolean): void {
    schema.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      styles: {
        background: filled ? color : 'rgba(0,0,0,0)',
        border: { color, width: 2 },
      },
    })
  }

  private appendPolygonMarker(schema: NovaSchema, center: { x: number; y: number }, points: Array<{ x: number; y: number }>, color: string, filled: boolean): void {
    schema.push({
      type: 'polygon',
      points: points.map(point => ({ x: center.x + point.x, y: center.y + point.y })),
      styles: {
        background: filled ? color : 'rgba(0,0,0,0)',
        stroke: color,
        lineWidth: 2,
      },
    })
  }

  private appendGatewayRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToWorld(element)
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
    this.appendGatewayMarker(schema, rect, normalizeBpmnGatewayType(element.data?.gatewayType))
    this.appendGatewayLabel(textWriter, element, rect)
  }

  private appendGatewayLabel(textWriter: BpmnRecipeTextWriter, element: ModelerElement, rect: ModelerRect): void {
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    }
    if (this.appendExternalGeometryLabel(textWriter, element, 'gateway-label', center)) return
    const layout = resolveBpmnGatewayNameLayout({
      name: typeof element.data?.name === 'string' ? element.data.name : undefined,
      width: rect.width,
      height: rect.height,
    })
    if (!layout.text) return
    layout.lines.forEach((line, index) => {
      textWriter.write(element.id, `gateway-label:${index}`, line.text, {
        x: center.x + line.x,
        y: center.y + line.y,
        width: line.widthLimit,
        height: line.height,
      })
    })
  }

  private appendExternalGeometryLabel(
    textWriter: BpmnRecipeTextWriter,
    element: ModelerElement,
    slotPrefix: string,
    anchor: { x: number; y: number },
  ): boolean {
    const geometry = normalizeRecipeLabelGeometry(element.data?.label)
    const text = typeof element.data?.name === 'string' ? element.data.name.trim() : ''
    if (!geometry || !text) return false
    const rect = {
      x: anchor.x + geometry.offsetX,
      y: anchor.y + geometry.offsetY,
      width: geometry.width,
      height: geometry.height,
    }
    const lines = createRecipeLabelLines(text, rect)
    lines.forEach((line, index) => {
      textWriter.write(element.id, `${slotPrefix}:${index}`, line.text, {
        x: rect.x,
        y: rect.y + index * 16,
        width: rect.width,
        height: 16,
      })
    })
    return true
  }

  private appendGatewayMarker(schema: NovaSchema, rect: ModelerRect, gatewayType: BpmnGatewayType): void {
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    const size = Math.min(rect.width, rect.height)
    const color = this.resolveThemeColor('bpmnGatewayMarkerStroke')
    const width = this.resolveThemeNumber('bpmnGatewayMarkerStrokeWidth')
    if (gatewayType === 'parallel') {
      this.appendGatewayPlusMarker(schema, center, size * 0.27, color, width)
      return
    }
    if (gatewayType === 'inclusive') {
      this.appendGatewayCircleMarker(schema, center, size * 0.2, color, width)
      return
    }
    if (gatewayType === 'complex') {
      this.appendGatewayAsteriskMarker(schema, center, size * 0.24, color, width)
      return
    }
    if (gatewayType === 'eventBased' || gatewayType === 'parallelEventBased') {
      const radius = size * 0.21
      this.appendGatewayCircleMarker(schema, center, radius, color, width)
      this.appendGatewayPentagonMarker(schema, center, radius * 0.72, color, width * 0.8)
      if (gatewayType === 'parallelEventBased') this.appendGatewayPlusMarker(schema, center, radius * 0.45, color, width)
      return
    }
    this.appendGatewayXMarker(schema, center, size * 0.18, color, width)
  }

  private appendGatewayXMarker(
    schema: NovaSchema,
    center: { x: number; y: number },
    size: number,
    color: string,
    width: number,
  ): void {
    this.appendLine(schema, center.x - size, center.y - size, center.x + size, center.y + size, color, width)
    this.appendLine(schema, center.x - size, center.y + size, center.x + size, center.y - size, color, width)
  }

  private appendGatewayPlusMarker(
    schema: NovaSchema,
    center: { x: number; y: number },
    size: number,
    color: string,
    width: number,
  ): void {
    this.appendLine(schema, center.x, center.y - size, center.x, center.y + size, color, width)
    this.appendLine(schema, center.x - size, center.y, center.x + size, center.y, color, width)
  }

  private appendGatewayCircleMarker(
    schema: NovaSchema,
    center: { x: number; y: number },
    radius: number,
    color: string,
    width: number,
  ): void {
    schema.push({
      type: 'circle',
      x: center.x,
      y: center.y,
      radius,
      styles: {
        background: 'rgba(0,0,0,0)',
        border: { color, width },
      },
    })
  }

  private appendGatewayAsteriskMarker(
    schema: NovaSchema,
    center: { x: number; y: number },
    size: number,
    color: string,
    width: number,
  ): void {
    this.appendGatewayPlusMarker(schema, center, size, color, width)
    this.appendGatewayXMarker(schema, center, size * 0.78, color, width)
  }

  private appendGatewayPentagonMarker(
    schema: NovaSchema,
    center: { x: number; y: number },
    radius: number,
    color: string,
    width: number,
  ): void {
    const points = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      }
    })
    schema.push({
      type: 'polygon',
      points,
      styles: {
        background: 'rgba(0,0,0,0)',
        stroke: color,
        lineWidth: width,
      },
    })
  }

  private appendDataObjectRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToWorld(element)
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
    textWriter.write(element.id, 'data-object-label', name, {
      x: rect.x,
      y: rect.y + rect.height + 2,
      width: rect.width,
      height: 22,
    })
  }

  private appendDataStoreRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToWorld(element)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    const fill = this.resolveElementFill(element, 'elementFill')
    schema.push({
      type: 'rect',
      ...rect,
      styles: {
        background: fill,
        border: { color: stroke, width: this.resolveElementStrokeWidth(element, 'elementStrokeWidth'), radius: 8 },
      },
    })
    const name = typeof element.data?.name === 'string' ? element.data.name : 'Data store'
    textWriter.write(element.id, 'data-store-label', name, insetRect(rect, 6, 4))
  }

  private appendGroupRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToWorld(element)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    schema.push({
      type: 'rect',
      ...rect,
      styles: {
        background: 'rgba(0,0,0,0)',
        border: {
          color: stroke,
          width: this.resolveElementStrokeWidth(element, 'elementStrokeWidth'),
          radius: 8,
          dashPattern: [6, 4],
        },
      },
    })
    const name = typeof element.data?.name === 'string' ? element.data.name : 'Group'
    textWriter.write(element.id, 'group-label', name, {
      x: rect.x + 8,
      y: rect.y + 6,
      width: Math.max(1, rect.width - 16),
      height: 18,
    })
  }

  private appendTextAnnotationRecipe(schema: NovaSchema, textWriter: BpmnRecipeTextWriter, element: ModelerElement): void {
    const rect = this.elementRectToWorld(element)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    const side = normalizeBpmnTextAnnotationBracketSide(element.data?.bracketSide)
    const x = side === 'left' ? rect.x : rect.x + rect.width
    const innerX = side === 'left' ? x + rect.width * 0.12 : x - rect.width * 0.12
    const width = this.resolveElementStrokeWidth(element, 'elementStrokeWidth')
    schema.push({ type: 'line', x1: x, y1: rect.y, x2: x, y2: rect.y + rect.height, styles: { color: stroke, width } })
    schema.push({ type: 'line', x1: x, y1: rect.y, x2: innerX, y2: rect.y, styles: { color: stroke, width } })
    schema.push({ type: 'line', x1: x, y1: rect.y + rect.height, x2: innerX, y2: rect.y + rect.height, styles: { color: stroke, width } })
    const text = typeof element.data?.text === 'string' ? element.data.text : 'Text annotation'
    textWriter.write(element.id, 'text-annotation-label', text, insetRect(rect, 14, 4))
  }

  private appendParticipantRecipe(schema: NovaSchema, element: BpmnParticipantElement): void {
    const layout = createBpmnParticipantLayout(element)
    const bounds = this.worldRect(layout.bounds)
    const stroke = this.resolveElementStroke(element, 'elementStroke')
    const fill = this.resolveElementFill(element, 'elementFill')
    const lineWidth = this.resolveElementStrokeWidth(element, 'elementStrokeWidth')
    schema.push({
      type: 'rect',
      ...bounds,
      styles: {
        background: fill,
        border: { color: stroke, width: lineWidth, radius: 4 },
      },
    })
    const participantHeader = this.worldRect(layout.participantHeaderRect)
    const laneHeaderArea = this.worldRect(layout.laneHeaderAreaRect)
    const laneHeadersVisible = areBpmnParticipantLaneHeadersVisible(element)
    const headerFill = 'rgba(248, 250, 252, 0.66)'
    layout.lanes.forEach(lane => {
      const fill = typeof lane.style?.fill === 'string' ? lane.style.fill : undefined
      if (fill) schema.push({ type: 'rect', ...this.worldRect(lane.contentRect), styles: { background: fill } })
      if (laneHeadersVisible) schema.push({ type: 'rect', ...this.worldRect(lane.headerRect), styles: { background: fill ?? headerFill } })
    })
    schema.push({ type: 'rect', ...participantHeader, styles: { background: headerFill } })
    const vertical = normalizeBpmnParticipantOrientation(element.data?.orientation) === 'vertical'
    if (vertical) {
      this.appendLine(schema, participantHeader.x, participantHeader.y + participantHeader.height, participantHeader.x + participantHeader.width, participantHeader.y + participantHeader.height, stroke, lineWidth)
      if (laneHeadersVisible) this.appendLine(schema, laneHeaderArea.x, laneHeaderArea.y + laneHeaderArea.height, laneHeaderArea.x + laneHeaderArea.width, laneHeaderArea.y + laneHeaderArea.height, stroke, lineWidth)
    } else {
      this.appendLine(schema, participantHeader.x + participantHeader.width, participantHeader.y, participantHeader.x + participantHeader.width, participantHeader.y + participantHeader.height, stroke, lineWidth)
      if (laneHeadersVisible) this.appendLine(schema, laneHeaderArea.x + laneHeaderArea.width, laneHeaderArea.y, laneHeaderArea.x + laneHeaderArea.width, laneHeaderArea.y + laneHeaderArea.height, stroke, lineWidth)
    }
    layout.lanes.slice(1).forEach(lane => {
      const rect = this.worldRect(lane.rect)
      if (vertical) this.appendLine(schema, rect.x, rect.y, rect.x, rect.y + rect.height, stroke, lineWidth)
      else this.appendLine(schema, rect.x, rect.y, rect.x + rect.width, rect.y, stroke, lineWidth)
    })
  }

  private appendTinyPlusMarker(schema: NovaSchema, rect: ModelerRect, color: string): void {
    const size = Math.max(1, Math.min(16, rect.height * 0.16))
    const x = rect.x + rect.width / 2
    const y = rect.y + rect.height - size * 1.2
    const width = 1.2
    schema.push({ type: 'line', x1: x - size / 2, y1: y, x2: x + size / 2, y2: y, styles: { color, width } })
    schema.push({ type: 'line', x1: x, y1: y - size / 2, x2: x, y2: y + size / 2, styles: { color, width } })
  }

  private appendLine(schema: NovaSchema, x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
    schema.push({ type: 'line', x1, y1, x2, y2, styles: { color, width } })
  }

  private elementRectToWorld(element: ModelerElement): ModelerRect {
    return this.worldRect({
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    })
  }

  private worldRect(rect: ModelerRect): ModelerRect {
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }
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
    return Math.max(0.5, normalized)
  }

  private resolveElementRadius(element: ModelerElement, token: ModelerThemeTokenKey): number {
    const value = Number(element.style?.radius ?? this.resolveThemeNumber(token))
    return Number.isFinite(value) && value > 0 ? value : 0
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

export interface BpmnRecipeLayerDiagnostics {
  recipeElements: number
  schemaFallbacks: number
  visibleElements: number
  culledElements: number
  dirtySlots: number
  batchRebuilds: number
  batchRevision: number
  panZoomRenderSkips: number
}

interface BpmnBatchRuntimeFinalizeInput {
  recipeElements: number
  visibleElements: number
  culledElements: number
  schemaFallbacks: number
  schemaItems: number
  textEnabled: boolean
  textColor: string
}

export class BpmnBatchRuntime {
  private readonly fillBatch: NovaRectBatch = createEmptyRectBatch()
  private readonly textBatch: NovaTextBatch = createEmptyTextBatch()
  private readonly slotMap = new Map<string, { fill: Array<number>; text: Array<number> }>()
  private readonly slotSignatures: Array<string> = []
  private previousSlotSignatures: Array<string> = []
  private revision = 0
  private diagnostics: BpmnRecipeLayerDiagnostics = {
    recipeElements: 0,
    schemaFallbacks: 0,
    visibleElements: 0,
    culledElements: 0,
    dirtySlots: 0,
    batchRebuilds: 0,
    batchRevision: 0,
    panZoomRenderSkips: 0,
  }
  private fillCount = 0
  private textCount = 0

  begin(): { fill: BpmnRecipeFillWriter; text: BpmnRecipeTextWriter } {
    this.fillCount = 0
    this.textCount = 0
    this.slotMap.clear()
    this.slotSignatures.length = 0
    return {
      fill: {
        write: (elementId, slotId, rect, color, radius) => this.writeFill(elementId, slotId, rect, color, radius),
      },
      text: {
        write: (elementId, slotId, text, rect) => this.writeText(elementId, slotId, text, rect),
      },
    }
  }

  finalize(input: BpmnBatchRuntimeFinalizeInput): void {
    const dirtySlots = countChangedSlots(this.previousSlotSignatures, this.slotSignatures)
    const changed = dirtySlots > 0
    if (changed) {
      this.revision += 1
      this.previousSlotSignatures = [...this.slotSignatures]
      this.diagnostics.batchRebuilds += 1
    } else {
      this.diagnostics.panZoomRenderSkips += 1
    }

    this.fillBatch.count = this.fillCount
    this.fillBatch.revision = this.revision
    this.fillBatch.staticRevision = this.revision
    this.textBatch.count = input.textEnabled ? this.textCount : 0
    this.textBatch.revision = this.revision
    this.textBatch.staticRevision = this.revision
    this.textBatch.color = input.textColor
    this.textBatch.font = {
      family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      size: 12,
      weight: '500',
    }
    this.textBatch.align = { horizontal: 'center', vertical: 'middle' }
    this.textBatch.lineHeight = 16
    this.textBatch.ellipsis = true
    this.textBatch.meta = { ...(this.textBatch.meta ?? {}), textRole: 'task-label' }
    this.textBatch.dirtyIndices = changed ? createDirtyIndices(this.textCount, dirtySlots) : []
    this.diagnostics = {
      ...this.diagnostics,
      recipeElements: input.recipeElements,
      schemaFallbacks: input.schemaFallbacks,
      visibleElements: input.visibleElements,
      culledElements: input.culledElements,
      dirtySlots,
      batchRevision: this.revision,
    }
  }

  getFillBatch(): NovaRectBatch {
    return this.fillBatch
  }

  getTextBatch(): NovaTextBatch {
    return this.textBatch
  }

  getSlotMap(): ReadonlyMap<string, { fill: Array<number>; text: Array<number> }> {
    return this.slotMap
  }

  getDiagnostics(): BpmnRecipeLayerDiagnostics {
    return { ...this.diagnostics }
  }

  private writeFill(elementId: string, slotId: string, rect: ModelerRect, color: string, radius = 0): boolean {
    const rgba = parseCssColor(color)
    if (!rgba) return false
    this.ensureFillCapacity(this.fillCount + 1)
    const index = this.fillCount
    const x = this.fillBatch.x as Float32Array
    const y = this.fillBatch.y as Float32Array
    const width = this.fillBatch.width as Float32Array
    const height = this.fillBatch.height as Float32Array
    const colors = this.fillBatch.colors as Float32Array
    const radii = this.fillBatch.radii as Float32Array
    x[index] = rect.x
    y[index] = rect.y
    width[index] = rect.width
    height[index] = rect.height
    colors[index * 4] = rgba[0]
    colors[index * 4 + 1] = rgba[1]
    colors[index * 4 + 2] = rgba[2]
    colors[index * 4 + 3] = rgba[3]
    radii[index] = radius
    this.trackSlot(elementId, 'fill', index)
    this.slotSignatures.push(createSlotSignature('fill', elementId, slotId, rect, `${color}:${radius}`))
    this.fillCount += 1
    return true
  }

  private writeText(elementId: string, slotId: string, text: string, rect: ModelerRect): void {
    if (text.trim().length === 0 || rect.width <= 1 || rect.height <= 1) return
    this.ensureTextCapacity(this.textCount + 1)
    const index = this.textCount
    const x = this.textBatch.x as Float32Array
    const y = this.textBatch.y as Float32Array
    const width = this.textBatch.width as Float32Array
    const height = this.textBatch.height as Float32Array
    ;(this.textBatch.text as Array<string>)[index] = text
    x[index] = rect.x
    y[index] = rect.y
    width[index] = rect.width
    height[index] = rect.height
    this.trackSlot(elementId, 'text', index)
    this.slotSignatures.push(createSlotSignature('text', elementId, slotId, rect, text))
    this.textCount += 1
  }

  private trackSlot(elementId: string, kind: 'fill' | 'text', index: number): void {
    const entry = this.slotMap.get(elementId) ?? { fill: [], text: [] }
    entry[kind].push(index)
    this.slotMap.set(elementId, entry)
  }

  private ensureFillCapacity(capacity: number): void {
    if (this.fillBatch.x.length >= capacity) return
    const nextCapacity = growCapacity(this.fillBatch.x.length, capacity)
    this.fillBatch.x = copyFloat32(this.fillBatch.x, nextCapacity)
    this.fillBatch.y = copyFloat32(this.fillBatch.y, nextCapacity)
    this.fillBatch.width = copyFloat32(this.fillBatch.width, nextCapacity)
    this.fillBatch.height = copyFloat32(this.fillBatch.height, nextCapacity)
    this.fillBatch.colors = copyFloat32(this.fillBatch.colors, nextCapacity * 4)
    this.fillBatch.radii = copyFloat32(this.fillBatch.radii ?? new Float32Array(0), nextCapacity)
  }

  private ensureTextCapacity(capacity: number): void {
    if (this.textBatch.x.length >= capacity) return
    const nextCapacity = growCapacity(this.textBatch.x.length, capacity)
    this.textBatch.x = copyFloat32(this.textBatch.x, nextCapacity)
    this.textBatch.y = copyFloat32(this.textBatch.y, nextCapacity)
    this.textBatch.width = copyFloat32(this.textBatch.width, nextCapacity)
    this.textBatch.height = copyFloat32(this.textBatch.height, nextCapacity)
    const nextText = new Array<string>(nextCapacity)
    for (let index = 0; index < (this.textBatch.text as Array<string>).length; index += 1) {
      nextText[index] = this.textBatch.text[index] ?? ''
    }
    this.textBatch.text = nextText
  }
}

interface BpmnRecipeFillWriter {
  write(elementId: string, slotId: string, rect: ModelerRect, color: string, radius?: number): boolean
}

interface BpmnRecipeTextWriter {
  write(elementId: string, slotId: string, text: string, rect: ModelerRect): void
}

function createEmptyRectBatch(): NovaRectBatch {
  return {
    count: 0,
    x: new Float32Array(0),
    y: new Float32Array(0),
    width: new Float32Array(0),
    height: new Float32Array(0),
    colors: new Float32Array(0),
    radii: new Float32Array(0),
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

function createFillRect(rect: ModelerRect, color: string, radius = 0): NovaSchema[number] {
  return {
    type: 'rect',
    ...rect,
    styles: { background: color, radius },
  }
}

function normalizeRecipeLabelGeometry(value: unknown): { offsetX: number; offsetY: number; width: number; height: number } | null {
  if (!value || typeof value !== 'object') return null
  const input = value as { offsetX?: unknown; offsetY?: unknown; width?: unknown; height?: unknown }
  if (!isFiniteNumber(input.offsetX) || !isFiniteNumber(input.offsetY) || !isFiniteNumber(input.width) || !isFiniteNumber(input.height)) return null
  return {
    offsetX: input.offsetX,
    offsetY: input.offsetY,
    width: Math.max(1, input.width),
    height: Math.max(1, input.height),
  }
}

function createRecipeLabelLines(text: string, rect: ModelerRect): Array<{ text: string }> {
  const maxLines = Math.max(1, Math.floor(rect.height / 16))
  const words = text.split(/\s+/).filter(Boolean)
  const lines: Array<{ text: string }> = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && next.length * 7 > rect.width) {
      lines.push({ text: current })
      current = word
      if (lines.length >= maxLines) break
      continue
    }
    current = next
  }
  if (current && lines.length < maxLines) lines.push({ text: current })
  if (lines.length === 0) lines.push({ text })
  return lines.slice(0, maxLines)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function createSlotSignature(kind: string, elementId: string, slotId: string, rect: ModelerRect, value: string): string {
  return [
    kind,
    elementId,
    slotId,
    roundSignatureNumber(rect.x),
    roundSignatureNumber(rect.y),
    roundSignatureNumber(rect.width),
    roundSignatureNumber(rect.height),
    value,
  ].join(':')
}

function countChangedSlots(previousSlots: ReadonlyArray<string>, nextSlots: ReadonlyArray<string>): number {
  const max = Math.max(previousSlots.length, nextSlots.length)
  let count = 0
  for (let index = 0; index < max; index += 1) {
    if (previousSlots[index] !== nextSlots[index]) count += 1
  }
  return count
}

function createDirtyIndices(count: number, dirtySlots: number): Uint32Array {
  if (count <= 0 || dirtySlots <= 0) return new Uint32Array(0)
  const dirtyCount = Math.min(count, dirtySlots)
  const indices = new Uint32Array(dirtyCount)
  for (let index = 0; index < dirtyCount; index += 1) indices[index] = index
  return indices
}

function roundSignatureNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '0.000'
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
