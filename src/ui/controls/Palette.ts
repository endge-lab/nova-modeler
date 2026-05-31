import {
  NovaComponent,
  NovaComponentNode,
  Prop,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import {
  NOVA_UI_LAYOUT_TARGET,
  type NovaUiLayoutConstraints,
  type NovaUiLayoutMeasure,
  type NovaUiLayoutRect,
} from '@endge/nova-ui-kit'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_CONTEXT,
  MODELER_CONTROLLER,
} from '@/config/context.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
} from '@/config/theme.config'
import type {
  ModelerController,
  ModelerGesture,
  ModelerPluginContext,
} from '@/domain/types/index'
import type {
  PaletteApi,
  PaletteDescriptor,
  PaletteItemLayout,
  PaletteItemType,
  PaletteProps,
  PaletteResolvedProps,
} from '@/domain/types/controls/palette.types'
import {
  BASIC_RECT_DEFAULT_HEIGHT,
  BASIC_RECT_DEFAULT_WIDTH,
  createBasicRectElement,
} from '@/elements/basic/rect/basic-rect.factory'
import {
  BPMN_EVENT_DEFAULT_SIZE,
  createBpmnEventElement,
} from '@/elements/bpmn/event/bpmn-event.factory'

@NovaComponent({
  type: Modeler.Palette,
  name: 'Palette',
  version: '0.1.0',
  dirtyPolicy: {
    matrix: ['x', 'y', 'zIndex'],
    update: ['width', 'height', 'position', 'inset', 'visible'],
    render: ['visible', 'controller'],
  },
})
export class Palette<E extends EventList = Record<string, any>>
  extends NovaComponentNode<PaletteResolvedProps, PaletteApi, Record<string, never>, PaletteProps, E> {
  readonly [NOVA_UI_LAYOUT_TARGET] = true as const

  private pressed = false
  private hoveredItem: PaletteItemType | null = null
  private pressedItem: PaletteItemType | null = null
  private activeDragItem: PaletteItemType | null = null
  private activePassthroughGesture: ModelerGesture | null = null
  private draggingItem: PaletteItemType | null = null
  private pressStartPoint: { x: number; y: number } | null = null
  private dragPreviewPoint: { x: number; y: number } | null = null
  private externalLayout = false
  private rectCounter = 0
  private bpmnEventCounter = 0

  @Prop.object<ModelerController>()
  declare controller?: ModelerController

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: PaletteDescriptor,
    props: PaletteResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({
      x: props.x,
      y: props.y,
      width: props.width,
      height: props.height,
      interactive: props.visible,
      zIndex: props.zIndex,
    })
    this.restoreLocalRenderBounds()
    this.setupEvents()
  }

  static normalizeProps(props: PaletteProps = {}): PaletteResolvedProps {
    return {
      controller: props.controller,
      x: finiteNumber(props.x, 0),
      y: finiteNumber(props.y, 0),
      width: Math.max(0, finiteNumber(props.width, 56)),
      height: Math.max(0, finiteNumber(props.height, 104)),
      position: props.position ?? 'static',
      inset: props.inset,
      zIndex: props.zIndex,
      visible: props.visible ?? true,
    }
  }

  override getApi(): PaletteApi {
    return {
      createRect: () => this.createRect(),
      createBpmnEvent: () => this.createBpmnEvent(),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: PaletteProps): this {
    super.setProps(patch as Partial<PaletteResolvedProps>)
    this.props = Palette.normalizeProps(this.props)
    if (!this.externalLayout) {
      this.options({
        x: this.props.x,
        y: this.props.y,
        width: this.props.width,
        height: this.props.height,
        interactive: this.props.visible,
        zIndex: this.props.zIndex,
      })
    }
    return this
  }

  applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    this.externalLayout = true
    const sizeChanged = this.width !== rect.width || this.height !== rect.height
    const changed = this.x !== rect.x || this.y !== rect.y || sizeChanged
    this.options({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
    if (this.draggingItem) this.expandLocalRenderBounds()
    else this.restoreLocalRenderBounds()
    if (changed) this.dirty({ matrix: true, update: sizeChanged, render: true })
    return changed
  }

  measureLayout(_constraints: NovaUiLayoutConstraints): NovaUiLayoutMeasure {
    return { width: this.props.width, height: this.props.height }
  }

  render(): void {
    super.render()
    if (!this.props.visible) {
      this.renderer.schema([] as unknown as NovaSchema)
      return
    }

    const schema: NovaSchema = []
    const width = this.width || this.props.width
    const height = this.height || this.props.height
    const items = this.createItemLayouts(width, height)

    schema.push({
      type: 'rect',
      x: 0,
      y: 0,
      width,
      height,
      styles: {
        background: this.resolvePaletteColor('paletteBackground'),
        border: {
          color: this.resolvePaletteColor('paletteBorderColor'),
          width: 1,
          radius: 6,
        },
      },
    })

    for (const item of items) {
      const activeBackground = this.pressedItem === item.type
        ? this.resolvePaletteColor('paletteItemPressedBackground')
        : this.hoveredItem === item.type
          ? this.resolvePaletteColor('paletteItemHoverBackground')
          : 'rgba(0,0,0,0)'

      schema.push({
        type: 'rect',
        x: item.x,
        y: item.y,
        width: item.size,
        height: item.size,
        styles: {
          background: activeBackground,
          border: {
            color: 'rgba(0,0,0,0)',
            width: 0,
            radius: 5,
          },
        },
      })

      if (item.type === 'basic.rect') this.appendRectIcon(schema, item.x, item.y, item.size)
      else this.appendBpmnEventIcon(schema, item.x, item.y, item.size)
    }

    this.appendDragPreview(schema)
    this.renderer.schema(schema)
  }

  private setupEvents(): void {
    this.on('mouseenter', event => {
      if (!this.props.visible) return
      this.hoveredItem = this.resolveItemAtEvent(event)
      this.dirty({ render: true })
    })
    this.on('mousemove', event => {
      if (!this.props.visible) return
      const next = this.resolveItemAtEvent(event)
      if (next === this.hoveredItem) return
      this.hoveredItem = next
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hoveredItem = null
      this.dirty({ render: true })
    })
    this.on('mousedown', event => {
      if (!this.props.visible) return false
      if (this.hasPointerModifier(event)) return this.startPassthroughGesture(event)
      const item = this.resolveItemAtEvent(event)
      this.pressed = !!item
      this.pressedItem = item
      this.activeDragItem = item
      this.draggingItem = null
      this.dragPreviewPoint = null
      this.pressStartPoint = this.events.getCanvasMousePosition(event)
      this.dirty({ render: true })
      return false
    })
    this.on('dragmove', event => {
      if (this.activePassthroughGesture) {
        const controller = this.resolveOptionalController()
        if (!controller) return false
        const result = this.activePassthroughGesture.onPointerMove?.(controller.getPluginContext(), event)
        if (result === false) return false
      }
      if (!this.activeDragItem) return false
      this.dragPreviewPoint = this.resolveLocalEventPoint(event)
      if (this.draggingItem === this.activeDragItem) {
        this.dirty({ render: true })
        return false
      }
      this.draggingItem = this.activeDragItem
      this.expandLocalRenderBounds()
      this.dirty({ render: true })
      return false
    })
    this.on('dragend', event => {
      if (this.activePassthroughGesture) {
        const controller = this.resolveOptionalController()
        const gesture = this.activePassthroughGesture
        this.activePassthroughGesture = null
        if (!controller) return false
        gesture.onPointerMove?.(controller.getPluginContext(), event)
        const result = gesture.onPointerUp?.(controller.getPluginContext(), event)
        if (result === false) return false
      }
      if (this.activeDragItem && this.draggingItem) {
        this.createElementAtEvent(this.activeDragItem, event)
      }
      this.resetPressState()
      return false
    })
    this.on('mouseup', event => {
      if (this.activePassthroughGesture) {
        const controller = this.resolveOptionalController()
        const gesture = this.activePassthroughGesture
        this.activePassthroughGesture = null
        if (!controller) return false
        gesture.onPointerMove?.(controller.getPluginContext(), event)
        const result = gesture.onPointerUp?.(controller.getPluginContext(), event)
        if (result === false) return false
      }
      if (!this.pressed) return false
      if (this.activeDragItem && this.hasPointerMovedBeyondClick(event)) {
        this.createElementAtEvent(this.activeDragItem, event)
      }
      this.resetPressState()
      this.dirty({ render: true })
      return false
    })
    this.on('dragcancel', () => {
      if (this.activePassthroughGesture) {
        const controller = this.resolveOptionalController()
        if (controller) this.activePassthroughGesture.onCancel?.(controller.getPluginContext())
        this.activePassthroughGesture = null
      }
      this.resetPressState()
    })
  }

  private resetPressState(): void {
    this.pressed = false
    this.pressedItem = null
    this.activeDragItem = null
    this.draggingItem = null
    this.pressStartPoint = null
    this.dragPreviewPoint = null
    this.restoreLocalRenderBounds()
    this.dirty({ render: true })
  }

  private expandLocalRenderBounds(): void {
    this.setLocalRenderBounds({
      x: -this.x,
      y: -this.y,
      width: this.surface.width,
      height: this.surface.height,
    })
  }

  private restoreLocalRenderBounds(): void {
    this.setLocalRenderBounds({
      x: 0,
      y: 0,
      width: this.width || this.props.width,
      height: this.height || this.props.height,
    })
  }

  private hasPointerMovedBeyondClick(event: MouseEvent): boolean {
    if (!this.pressStartPoint) return false
    const point = this.events.getCanvasMousePosition(event)
    return Math.abs(point.x - this.pressStartPoint.x) > 2
      || Math.abs(point.y - this.pressStartPoint.y) > 2
  }

  private hasPointerModifier(event: MouseEvent): boolean {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
  }

  private startPassthroughGesture(event: MouseEvent): false | void {
    const controller = this.resolveOptionalController()
    if (!controller) return
    const context = controller.getPluginContext()
    const target = controller.hitTest(this.events.getCanvasMousePosition(event))
    for (const gesture of controller.getGestures()) {
      if (!gesture.hitTest?.(context, event, target)) continue
      this.activePassthroughGesture = gesture
      const result = gesture.onPointerDown?.(context, event)
      if (result === false) return false
      return
    }
  }

  private resolveOptionalController(): ModelerController | undefined {
    return this.props.controller ?? this.injectOptional(MODELER_CONTROLLER)
  }

  private createElementAtEvent(type: PaletteItemType, event: MouseEvent): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context) return

    const point = this.events.getCanvasMousePosition(event)
    if (!this.isPointInsideCanvas(context, point)) return

    const center = context.screenToWorld(point)
    if (type === 'basic.rect') this.createRectAt(center)
    if (type === 'bpmn.event') this.createBpmnEventAt(center)
  }

  private createRect(): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context) return

    this.createRectAt(this.resolveInsertCenter(context))
  }

  private createRectAt(center: { x: number; y: number }): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context) return

    const id = `basic-rect-${Date.now().toString(36)}-${this.rectCounter += 1}`
    context.applyCommand({
      type: 'element.add',
      element: createBasicRectElement({
        id,
        x: Math.round(center.x - 80),
        y: Math.round(center.y - 48),
      }),
    })
    context.applyCommand({ type: 'select', ids: [id] })
  }

  private createBpmnEvent(): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context) return

    this.createBpmnEventAt(this.resolveInsertCenter(context))
  }

  private createBpmnEventAt(center: { x: number; y: number }): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context) return

    const id = `bpmn-event-${Date.now().toString(36)}-${this.bpmnEventCounter += 1}`
    context.applyCommand({
      type: 'element.add',
      element: createBpmnEventElement({
        id,
        x: Math.round(center.x - 24),
        y: Math.round(center.y - 24),
        eventPosition: 'start',
        trigger: 'none',
      }),
    })
    context.applyCommand({ type: 'select', ids: [id] })
  }

  private resolveInsertCenter(context: ModelerController | ModelerPluginContext): { x: number; y: number } {
    const layout = context.getLayout()
    return context.screenToWorld({
      x: layout.width / 2,
      y: layout.height / 2,
    })
  }

  private isPointInsideCanvas(context: ModelerController | ModelerPluginContext, point: { x: number; y: number }): boolean {
    const canvas = context.getLayout().canvas
    return point.x >= canvas.x
      && point.x <= canvas.x + canvas.width
      && point.y >= canvas.y
      && point.y <= canvas.y + canvas.height
  }

  private resolveItemAtEvent(event: MouseEvent): PaletteItemType | null {
    const point = this.resolveLocalEventPoint(event)
    return this.resolveItemAtLocalPoint(point.x, point.y)
  }

  private resolveLocalEventPoint(event: MouseEvent): { x: number; y: number } {
    const { x, y } = this.events.getCanvasMousePosition(event)
    const [localX, localY] = this.toLocal(x, y)
    return { x: localX, y: localY }
  }

  private resolveItemAtLocalPoint(x: number, y: number): PaletteItemType | null {
    for (const item of this.createItemLayouts(this.width || this.props.width, this.height || this.props.height)) {
      if (x >= item.x && x <= item.x + item.size && y >= item.y && y <= item.y + item.size) return item.type
    }
    return null
  }

  private createItemLayouts(width: number, height: number): Array<PaletteItemLayout> {
    const itemSize = Math.min(40, Math.max(0, width - 16))
    const gap = 8
    const totalHeight = itemSize * 2 + gap
    const itemX = (width - itemSize) / 2
    const startY = Math.max(8, (height - totalHeight) / 2)
    return [
      { type: 'basic.rect', x: itemX, y: startY, size: itemSize },
      { type: 'bpmn.event', x: itemX, y: startY + itemSize + gap, size: itemSize },
    ]
  }

  private appendRectIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const iconWidth = Math.round(size * 0.58)
    const iconHeight = Math.round(size * 0.38)
    schema.push({
      type: 'rect',
      x: x + (size - iconWidth) / 2,
      y: y + (size - iconHeight) / 2,
      width: iconWidth,
      height: iconHeight,
      styles: {
        background: this.resolvePaletteColor('paletteIconFill'),
        border: {
          color: this.resolvePaletteColor('paletteIconStroke'),
          width: 2,
          radius: 4,
        },
      },
    })
  }

  private appendBpmnEventIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    schema.push({
      type: 'circle',
      x: x + size / 2,
      y: y + size / 2,
      radius: Math.max(0, size * 0.28),
      styles: {
        background: this.resolvePaletteColor('paletteIconFill'),
        border: {
          color: this.resolvePaletteColor('paletteIconStroke'),
          width: 2,
        },
      },
    })
  }

  private appendDragPreview(schema: NovaSchema): void {
    if (!this.draggingItem || !this.dragPreviewPoint) return

    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const scale = context?.getViewport().scale ?? 1
    if (this.draggingItem === 'basic.rect') {
      const width = BASIC_RECT_DEFAULT_WIDTH * scale
      const height = BASIC_RECT_DEFAULT_HEIGHT * scale
      schema.push({
        type: 'rect',
        x: this.dragPreviewPoint.x - width / 2,
        y: this.dragPreviewPoint.y - height / 2,
        width,
        height,
        styles: {
          background: this.resolvePaletteColor('palettePreviewFill'),
          border: {
            color: this.resolvePaletteColor('palettePreviewStroke'),
            width: 1.5,
            radius: 6,
          },
          opacity: this.resolvePaletteNumber('palettePreviewOpacity'),
        },
      })
      return
    }

    const radius = (BPMN_EVENT_DEFAULT_SIZE * scale) / 2
    schema.push({
      type: 'circle',
      x: this.dragPreviewPoint.x,
      y: this.dragPreviewPoint.y,
      radius,
      styles: {
        background: this.resolvePaletteColor('palettePreviewFill'),
        border: {
          color: this.resolvePaletteColor('palettePreviewStroke'),
          width: 1.5,
        },
        opacity: this.resolvePaletteNumber('palettePreviewOpacity'),
      },
    })
  }

  private resolvePaletteColor(token: keyof typeof MODELER_THEME_FALLBACKS): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return String(this.nova.theme.resolve(
      MODELER_THEME_TOKENS[token],
      fallback,
    ) ?? fallback)
  }

  private resolvePaletteNumber(token: keyof typeof MODELER_THEME_FALLBACKS): number {
    const fallback = Number(MODELER_THEME_FALLBACKS[token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
}

export const MODELER_PALETTE_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  PaletteResolvedProps,
  PaletteApi,
  Record<string, never>,
  PaletteProps
>(Palette as never) as PaletteDescriptor

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
