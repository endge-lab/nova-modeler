import {
  NovaComponent,
  NovaComponentNode,
  Prop,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaCursorDeclaration,
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
  ModelerPaletteItemDefinition,
  ModelerPalettePlacement,
  ModelerPluginContext,
} from '@/domain/types/index'
import type {
  PaletteApi,
  PaletteDescriptor,
  PaletteDividerLayout,
  PaletteGripLayout,
  PaletteLayoutEntry,
  PaletteProps,
  PaletteResolvedProps,
} from '@/domain/types/controls/palette.types'

type PaletteOrientation = 'vertical' | 'horizontal'
type PaletteDockMode = 'docked' | 'floating'

interface PaletteResolvedLayoutOptions {
  placement: ModelerPalettePlacement
  orientation: PaletteOrientation
  draggable: boolean
  offset: number
  itemSize: number
  gap: number
  padding: number
  gripSize: number
}

interface PaletteLayoutPlan {
  entries: Array<PaletteLayoutEntry>
  width: number
  height: number
}

const PALETTE_CURSOR_RULES: NovaCursorDeclaration = [
  { when: { state: ['pressed', 'dragging'], paletteCursor: 'grip' }, use: 'grabbing' },
  { when: { paletteCursor: 'grip' }, use: 'grab' },
  { when: { paletteCursor: 'item' }, use: 'pointer' },
  { use: 'default' },
]

@NovaComponent({
  type: Modeler.Palette,
  name: 'Palette',
  version: '0.1.0',
  dirtyPolicy: {
    matrix: ['x', 'y', 'zIndex'],
    update: ['width', 'height', 'position', 'inset', 'visible', 'placement', 'draggable', 'offset', 'itemSize', 'gap', 'padding', 'gripSize'],
    render: ['visible', 'controller', 'placement', 'draggable', 'offset', 'itemSize', 'gap', 'padding', 'gripSize'],
  },
})
export class Palette<E extends EventList = Record<string, any>>
  extends NovaComponentNode<PaletteResolvedProps, PaletteApi, Record<string, never>, PaletteProps, E> {
  readonly [NOVA_UI_LAYOUT_TARGET] = true as const

  private pressed = false
  private hoveredItem: string | null = null
  private pressedItem: string | null = null
  private activeDragItem: string | null = null
  private activePassthroughGesture: ModelerGesture | null = null
  private draggingItem: string | null = null
  private activeGrip = false
  private paletteMode: PaletteDockMode = 'docked'
  private floatingPosition: { x: number; y: number } | null = null
  private paletteDragStart: { x: number; y: number; paletteX: number; paletteY: number } | null = null
  private pressStartPoint: { x: number; y: number } | null = null
  private dragPreviewPoint: { x: number; y: number } | null = null
  private externalLayout = false
  private disposeToolSubscription: (() => void) | undefined
  private lastPlacement: ModelerPalettePlacement | null = null

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
      cursor: PALETTE_CURSOR_RULES,
      cursorContext: { paletteCursor: 'none' },
    })
    this.restoreLocalRenderBounds()
    this.setupEvents()
  }

  static normalizeProps(props: PaletteProps = {}): PaletteResolvedProps {
    return {
      controller: props.controller,
      placement: props.placement,
      draggable: props.draggable,
      offset: props.offset,
      itemSize: props.itemSize,
      gap: props.gap,
      padding: props.padding,
      gripSize: props.gripSize,
      x: finiteNumber(props.x, 0),
      y: finiteNumber(props.y, 0),
      width: Math.max(0, finiteNumber(props.width, 56)),
      height: Math.max(0, finiteNumber(props.height, 152)),
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
      this.syncPaletteFrame()
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
    const plan = this.createLayoutPlan(this.resolvePaletteLayoutOptions())
    return { width: plan.width, height: plan.height }
  }

  update(): void {
    super.update()
    if (!this.externalLayout) this.syncPaletteFrame()
  }

  protected override onMount(): void {
    super.onMount()
    this.subscribeToActiveTool()
  }

  protected override onUnmount(): void {
    this.disposeToolSubscription?.()
    this.disposeToolSubscription = undefined
    super.onUnmount()
  }

  render(): void {
    super.render()
    if (!this.props.visible) {
      this.renderer.schema([] as unknown as NovaSchema)
      return
    }

    const schema: NovaSchema = []
    const layoutOptions = this.resolvePaletteLayoutOptions()
    const plan = this.createLayoutPlan(layoutOptions)
    const width = plan.width
    const height = plan.height

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

    const context = this.resolveContext()
    const activeToolId = context?.tools.getActiveId() ?? null
    for (const entry of plan.entries) {
      if (entry.type === 'divider') {
        this.appendDivider(schema, entry, layoutOptions)
        continue
      }
      if (entry.type === 'grip') {
        this.appendGrip(schema, entry)
        continue
      }
      const item = entry.item
      const activeBackground = this.pressedItem === item.id || activeToolId === item.toolId
        ? this.resolvePaletteColor('paletteItemPressedBackground')
        : this.hoveredItem === item.id
          ? this.resolvePaletteColor('paletteItemHoverBackground')
          : 'rgba(0,0,0,0)'

      schema.push({
        type: 'rect',
        x: entry.x,
        y: entry.y,
        width: entry.size,
        height: entry.size,
        styles: {
          background: activeBackground,
          border: {
            color: 'rgba(0,0,0,0)',
            width: 0,
            radius: 5,
          },
        },
      })

      this.appendItemIcon(schema, item, entry.x, entry.y, entry.size)
    }

    this.appendDragPreview(schema)
    this.renderer.schema(schema)
  }

  private setupEvents(): void {
    this.on('mouseenter', event => {
      if (!this.props.visible) return
      this.setPaletteCursorFromEvent(event)
      this.hoveredItem = this.resolveItemAtEvent(event)
      this.dirty({ render: true })
    })
    this.on('mousemove', event => {
      if (!this.props.visible) return
      this.setPaletteCursorFromEvent(event)
      const next = this.resolveItemAtEvent(event)
      if (next === this.hoveredItem) return
      this.hoveredItem = next
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hoveredItem = null
      this.setPaletteCursor(null)
      this.dirty({ render: true })
    })
    this.on('mousedown', event => {
      if (!this.props.visible) return false
      if (this.hasPointerModifier(event)) return this.startPassthroughGesture(event)
      const grip = this.resolveGripAtEvent(event)
      if (grip && this.resolvePaletteLayoutOptions().draggable) {
        const point = this.events.getCanvasMousePosition(event)
        this.pressed = true
        this.activeGrip = true
        this.paletteDragStart = { x: point.x, y: point.y, paletteX: this.x, paletteY: this.y }
        this.setPaletteCursor('grip')
        this.dirty({ render: true })
        return false
      }
      const item = this.resolveItemAtEvent(event)
      if (item && !this.isCreateToolItem(item)) {
        this.runPaletteItem(item)
        this.pressed = false
        this.pressedItem = null
        this.activeDragItem = null
        this.draggingItem = null
        this.dragPreviewPoint = null
        this.pressStartPoint = null
        this.dirty({ render: true })
        return false
      }
      this.pressed = !!item
      this.pressedItem = item
      this.activeDragItem = item
      this.activeGrip = false
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
      if (this.activeGrip) {
        this.movePaletteByEvent(event)
        return false
      }
      if (!this.activeDragItem || !this.isCreateToolItem(this.activeDragItem)) return false
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
      } else if (this.activeDragItem) {
        this.runPaletteItem(this.activeDragItem)
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
      if (this.activeGrip) {
        this.movePaletteByEvent(event)
        this.resetPressState()
        return
      }
      if (this.activeDragItem && this.hasPointerMovedBeyondClick(event)) {
        this.createElementAtEvent(this.activeDragItem, event)
      } else if (this.activeDragItem) {
        this.runPaletteItem(this.activeDragItem)
      }
      this.resetPressState()
      this.dirty({ render: true })
      return false
    })
    this.on('click', event => {
      if (!this.props.visible) return false
      const item = this.resolveItemAtEvent(event)
      if (item) this.runPaletteItem(item)
      return false
    })
    this.on('dblclick', event => {
      if (!this.props.visible) return false
      if (this.resolveGripAtEvent(event)) {
        this.resetDockedPosition()
        return false
      }
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

  private subscribeToActiveTool(): void {
    this.disposeToolSubscription?.()
    this.disposeToolSubscription = this.resolveContext()?.tools.subscribe(() => {
      this.dirty({ render: true })
    })
  }

  private resetPressState(): void {
    this.pressed = false
    this.pressedItem = null
    this.activeDragItem = null
    this.activeGrip = false
    this.paletteDragStart = null
    this.draggingItem = null
    this.pressStartPoint = null
    this.dragPreviewPoint = null
    this.restoreLocalRenderBounds()
    this.setPaletteCursor(null)
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

  private setPaletteCursorFromEvent(event: MouseEvent): void {
    if (this.resolveGripAtEvent(event)) {
      this.setPaletteCursor('grip')
      return
    }
    this.setPaletteCursor(this.resolveItemAtEvent(event) ? 'item' : null)
  }

  private setPaletteCursor(cursor: 'grip' | 'item' | null): void {
    this.options({ cursorContext: { paletteCursor: cursor ?? 'none' } })
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

  private resolveContext(): ModelerPluginContext | undefined {
    return this.resolveOptionalController()?.getPluginContext()
      ?? this.injectOptional(MODELER_CONTEXT)
  }

  private createElementAtEvent(itemId: string, event: MouseEvent): void {
    const context = this.resolveContext()
    if (!context) return

    const item = context.palette.get(itemId)
    if (!item?.toolId) return
    const point = this.events.getCanvasMousePosition(event)
    if (!this.isPointInsideCanvas(context, point)) return

    const center = context.screenToWorld(point)
    context.tools.createAt(item.toolId, center)
  }

  private createRect(): void {
    const context = this.resolveContext()
    if (!context) return

    context.tools.createAt('create:basic.rect', this.resolveInsertCenter(context))
  }

  private createBpmnEvent(): void {
    const context = this.resolveContext()
    if (!context) return

    context.tools.createAt('create:bpmn.event', this.resolveInsertCenter(context))
  }

  private runPaletteItem(itemId: string): void {
    const context = this.resolveContext()
    if (!context) return

    const item = context.palette.get(itemId)
    if (!item) return
    if (item.actionId) context.actions.run(item.actionId)
    if (item.toolId) context.tools.activate(item.toolId)
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

  private syncPaletteFrame(): void {
    const options = this.resolvePaletteLayoutOptions()
    if (this.lastPlacement && this.lastPlacement !== options.placement) {
      this.paletteMode = 'docked'
      this.floatingPosition = null
    }
    this.lastPlacement = options.placement
    if (!options.draggable) {
      this.paletteMode = 'docked'
      this.floatingPosition = null
    }

    const plan = this.createLayoutPlan(options)
    const position = this.paletteMode === 'floating' && this.floatingPosition
      ? this.clampPalettePosition(this.floatingPosition, plan.width, plan.height)
      : this.resolveDockedPosition(options, plan.width, plan.height)
    if (this.paletteMode === 'floating') this.floatingPosition = position

    this.options({
      x: position.x,
      y: position.y,
      width: plan.width,
      height: plan.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
    if (this.draggingItem) this.expandLocalRenderBounds()
    else this.restoreLocalRenderBounds()
  }

  private resolvePaletteLayoutOptions(): PaletteResolvedLayoutOptions {
    const options = this.resolveContext()?.getOptions().palette
    const placement = this.props.placement ?? options?.placement ?? 'left'
    return {
      placement,
      orientation: placement === 'left' || placement === 'right' ? 'vertical' : 'horizontal',
      draggable: this.props.draggable ?? options?.draggable ?? true,
      offset: this.resolvePaletteNumberOption(this.props.offset, options?.offset, 16),
      itemSize: this.resolvePaletteNumberOption(this.props.itemSize, options?.itemSize, 40),
      gap: this.resolvePaletteNumberOption(this.props.gap, options?.gap, 8),
      padding: this.resolvePaletteNumberOption(this.props.padding, options?.padding, 8),
      gripSize: this.resolvePaletteNumberOption(this.props.gripSize, options?.gripSize, 32),
    }
  }

  private resolvePaletteNumberOption(prop: number | undefined, option: number | undefined, fallback: number): number {
    return Math.max(0, finiteNumber(prop, finiteNumber(option, fallback)))
  }

  private resolveDockedPosition(
    options: PaletteResolvedLayoutOptions,
    width: number,
    height: number,
  ): { x: number; y: number } {
    const surfaceWidth = this.surface.width
    const surfaceHeight = this.surface.height
    if (options.placement === 'right') {
      return {
        x: Math.max(0, surfaceWidth - width - options.offset),
        y: options.offset,
      }
    }
    if (options.placement === 'top') {
      return { x: options.offset, y: options.offset }
    }
    if (options.placement === 'bottom') {
      return {
        x: options.offset,
        y: Math.max(0, surfaceHeight - height - options.offset),
      }
    }
    return { x: options.offset, y: options.offset }
  }

  private movePaletteByEvent(event: MouseEvent): void {
    if (!this.paletteDragStart) return
    const point = this.events.getCanvasMousePosition(event)
    const plan = this.createLayoutPlan(this.resolvePaletteLayoutOptions())
    const next = this.clampPalettePosition({
      x: this.paletteDragStart.paletteX + point.x - this.paletteDragStart.x,
      y: this.paletteDragStart.paletteY + point.y - this.paletteDragStart.y,
    }, plan.width, plan.height)
    this.paletteMode = 'floating'
    this.floatingPosition = next
    this.options({ x: next.x, y: next.y })
    this.dirty({ matrix: true, render: true })
  }

  private resetDockedPosition(): void {
    this.paletteMode = 'docked'
    this.floatingPosition = null
    this.syncPaletteFrame()
    this.dirty({ matrix: true, render: true })
  }

  private clampPalettePosition(position: { x: number; y: number }, width: number, height: number): { x: number; y: number } {
    return {
      x: clamp(position.x, 0, Math.max(0, this.surface.width - width)),
      y: clamp(position.y, 0, Math.max(0, this.surface.height - height)),
    }
  }

  private resolveItemAtEvent(event: MouseEvent): string | null {
    const point = this.resolveLocalEventPoint(event)
    return this.resolveItemAtLocalPoint(point.x, point.y)
  }

  private resolveLocalEventPoint(event: MouseEvent): { x: number; y: number } {
    const { x, y } = this.events.getCanvasMousePosition(event)
    const [localX, localY] = this.toLocal(x, y)
    return { x: localX, y: localY }
  }

  private resolveItemAtLocalPoint(x: number, y: number): string | null {
    for (const item of this.createLayoutPlan(this.resolvePaletteLayoutOptions()).entries) {
      if (item.type !== 'item') continue
      if (x >= item.x && x <= item.x + item.size && y >= item.y && y <= item.y + item.size) return item.item.id
    }
    return null
  }

  private resolveGripAtEvent(event: MouseEvent): PaletteGripLayout | null {
    const point = this.resolveLocalEventPoint(event)
    for (const item of this.createLayoutPlan(this.resolvePaletteLayoutOptions()).entries) {
      if (item.type !== 'grip') continue
      if (point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height) return item
    }
    return null
  }

  private createLayoutPlan(options: PaletteResolvedLayoutOptions): PaletteLayoutPlan {
    const context = this.resolveContext()
    const items = context?.palette.getItems() ?? []
    const layout: Array<PaletteLayoutEntry> = []
    if (options.orientation === 'horizontal') return this.createHorizontalLayoutPlan(items, options, layout)
    return this.createVerticalLayoutPlan(items, options, layout)
  }

  private createVerticalLayoutPlan(
    items: Array<ModelerPaletteItemDefinition>,
    options: PaletteResolvedLayoutOptions,
    layout: Array<PaletteLayoutEntry>,
  ): PaletteLayoutPlan {
    const width = options.padding * 2 + options.itemSize
    const itemX = options.padding
    let y = options.padding
    const context = this.resolveContext()
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      if (!item) continue
      layout.push({ type: 'item', item, x: itemX, y, size: options.itemSize })
      y += options.itemSize
      const next = items[index + 1]
      const shouldDivide = context?.getOptions().palette?.groups?.[item.group]?.dividerAfter && next?.group !== item.group
      if (shouldDivide) {
        y += options.gap
        layout.push({ type: 'divider', x: options.padding, y, width: options.itemSize, height: 1 })
        y += 1 + options.gap
      } else {
        y += options.gap
      }
    }
    if (options.draggable) {
      const gripY = y
      layout.push({ type: 'grip', x: options.padding, y: gripY, width: options.itemSize, height: options.gripSize })
      y += options.gripSize
    } else if (layout.length > 0) {
      y -= options.gap
    }
    return { entries: layout, width, height: Math.max(options.padding * 2, y + options.padding) }
  }

  private createHorizontalLayoutPlan(
    items: Array<ModelerPaletteItemDefinition>,
    options: PaletteResolvedLayoutOptions,
    layout: Array<PaletteLayoutEntry>,
  ): PaletteLayoutPlan {
    const height = options.padding * 2 + options.itemSize
    const itemY = options.padding
    let x = options.padding
    const context = this.resolveContext()
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      if (!item) continue
      layout.push({ type: 'item', item, x, y: itemY, size: options.itemSize })
      x += options.itemSize
      const next = items[index + 1]
      const shouldDivide = context?.getOptions().palette?.groups?.[item.group]?.dividerAfter && next?.group !== item.group
      if (shouldDivide) {
        x += options.gap
        layout.push({ type: 'divider', x, y: options.padding, width: 1, height: options.itemSize })
        x += 1 + options.gap
      } else {
        x += options.gap
      }
    }
    if (options.draggable) {
      const gripX = x
      layout.push({ type: 'grip', x: gripX, y: options.padding, width: options.gripSize, height: options.itemSize })
      x += options.gripSize
    } else if (layout.length > 0) {
      x -= options.gap
    }
    return { entries: layout, width: Math.max(options.padding * 2, x + options.padding), height }
  }

  private isCreateToolItem(itemId: string): boolean {
    const context = this.resolveContext()
    const item = context?.palette.get(itemId)
    const tool = item?.toolId ? context?.tools.get(item.toolId) : undefined
    return tool?.kind === 'create-element'
  }

  private appendDivider(schema: NovaSchema, entry: PaletteDividerLayout, options: PaletteResolvedLayoutOptions): void {
    if (options.orientation === 'horizontal') {
      schema.push({
        type: 'line',
        x1: entry.x,
        y1: entry.y,
        x2: entry.x,
        y2: entry.y + entry.height,
        styles: {
          color: this.resolvePaletteColor('paletteBorderColor'),
          width: 1,
        },
      })
      return
    }
    schema.push({
      type: 'line',
      x1: entry.x,
      y1: entry.y,
      x2: entry.x + entry.width,
      y2: entry.y,
      styles: {
        color: this.resolvePaletteColor('paletteBorderColor'),
        width: 1,
      },
    })
  }

  private appendGrip(schema: NovaSchema, entry: PaletteGripLayout): void {
    const color = this.resolvePaletteColor('paletteIconStroke')
    const centerX = entry.x + entry.width / 2
    const centerY = entry.y + entry.height / 2
    const colGap = Math.min(7, entry.width / 4)
    const rowGap = Math.min(6, entry.height / 4)
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        schema.push({
          type: 'circle',
          x: centerX + (col - 1) * colGap,
          y: centerY + (row - 0.5) * rowGap,
          radius: 1.6,
          styles: {
            background: color,
            border: { color, width: 0 },
          },
        })
      }
    }
  }

  private appendItemIcon(schema: NovaSchema, item: ModelerPaletteItemDefinition, x: number, y: number, size: number): void {
    if (item.icon === 'marquee-rect') {
      this.appendMarqueeIcon(schema, x, y, size)
      return
    }
    if (item.icon?.startsWith('bpmn-event')) {
      this.appendBpmnEventIcon(schema, x, y, size, item.icon)
      return
    }
    this.appendRectIcon(schema, x, y, size)
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

  private appendBpmnEventIcon(schema: NovaSchema, x: number, y: number, size: number, icon: string): void {
    const strokeWidth = icon === 'bpmn-event-end' ? 3 : 2
    const radius = Math.max(0, size * 0.24)
    schema.push({
      type: 'circle',
      x: x + size / 2,
      y: y + size / 2,
      radius,
      styles: {
        background: this.resolvePaletteColor('paletteIconFill'),
        border: {
          color: this.resolvePaletteColor('paletteIconStroke'),
          width: strokeWidth,
        },
      },
    })
    if (icon !== 'bpmn-event-intermediate') return
    schema.push({
      type: 'circle',
      x: x + size / 2,
      y: y + size / 2,
      radius: Math.max(0, radius - 3),
      styles: {
        background: 'rgba(0,0,0,0)',
        border: {
          color: this.resolvePaletteColor('paletteIconStroke'),
          width: 2,
        },
      },
    })
  }

  private appendMarqueeIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const left = x + size * 0.24
    const top = y + size * 0.24
    const right = x + size * 0.76
    const bottom = y + size * 0.76
    const color = this.resolvePaletteColor('paletteIconStroke')
    const segments: Array<[number, number, number, number]> = [
      [left, top, left + size * 0.16, top],
      [right - size * 0.16, top, right, top],
      [left, bottom, left + size * 0.16, bottom],
      [right - size * 0.16, bottom, right, bottom],
      [left, top, left, top + size * 0.16],
      [left, bottom - size * 0.16, left, bottom],
      [right, top, right, top + size * 0.16],
      [right, bottom - size * 0.16, right, bottom],
    ]
    segments.forEach(([x1, y1, x2, y2]) => {
      schema.push({
        type: 'line',
        x1,
        y1,
        x2,
        y2,
        styles: { color, width: 2 },
      })
    })
  }

  private appendDragPreview(schema: NovaSchema): void {
    if (!this.draggingItem || !this.dragPreviewPoint) return

    const context = this.resolveContext()
    const scale = context?.getViewport().scale ?? 1
    const item = context?.palette.get(this.draggingItem)
    if (item?.icon !== 'bpmn-event') {
      const width = 160 * scale
      const height = 96 * scale
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

    const radius = (48 * scale) / 2
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
