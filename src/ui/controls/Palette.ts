import type { NovaApp, NovaCursorDeclaration, NovaSchema, NovaSurface } from '@endge/nova'
import type { NovaTooltipTargetResolver, NovaUiLayoutConstraints, NovaUiLayoutMeasure, NovaUiLayoutRect, TooltipInput, TooltipTargetResolution } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type {
  PaletteApi,
  PaletteDescriptor,
  PaletteDividerLayout,
  PaletteGripLayout,
  PaletteLayoutEntry,
  PaletteProps,
  PaletteResolvedProps,
} from '@/domain/types/controls/palette.types'
import type {
  ModelerController,
  ModelerGesture,
  ModelerPaletteItemDefinition,
  ModelerPalettePlacement,
  ModelerPluginContext,
} from '@/domain/types/index'
import {
  createNovaDecoratedComponentDescriptor,

  NovaComponent,
  NovaComponentNode,

  Prop,
} from '@endge/nova'
import {
  NOVA_UI_LAYOUT_TARGET,

} from '@endge/nova-ui-kit'
import {
  MODELER_CONTEXT,
  MODELER_CONTROLLER,
} from '@/config/context.config'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
} from '@/config/theme.config'

type PaletteOrientation = 'vertical' | 'horizontal'
type PaletteDockMode = 'docked' | 'floating'
type PaletteDragPreviewShape
  = | 'basic-rect'
    | 'bpmn-event'
    | 'bpmn-activity'
    | 'bpmn-task'
    | 'bpmn-gateway'
    | 'bpmn-text-annotation'
    | 'bpmn-group'
    | 'bpmn-swimlane'
    | 'bpmn-data-object'
    | 'bpmn-data-store'

interface PaletteResolvedLayoutOptions {
  placement: ModelerPalettePlacement
  orientation: PaletteOrientation
  draggable: boolean
  offset: number
  offsetX: number
  offsetY: number
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
    update: ['width', 'height', 'position', 'inset', 'visible', 'placement', 'draggable', 'offset', 'offsetX', 'offsetY', 'itemSize', 'gap', 'padding', 'gripSize'],
    render: ['visible', 'controller', 'placement', 'draggable', 'offset', 'offsetX', 'offsetY', 'itemSize', 'gap', 'padding', 'gripSize'],
  },
})
export class Palette<E extends EventList = Record<string, any>>
  extends NovaComponentNode<PaletteResolvedProps, PaletteApi, Record<string, never>, PaletteProps, E>
  implements NovaTooltipTargetResolver {
  readonly [NOVA_UI_LAYOUT_TARGET] = true as const

  private _pressed = false
  private _hoveredItem: string | null = null
  private _pressedItem: string | null = null
  private _activeDragItem: string | null = null
  private _activePassthroughGesture: ModelerGesture | null = null
  private _draggingItem: string | null = null
  private _activeGrip = false
  private _paletteMode: PaletteDockMode = 'docked'
  private _floatingPosition: { x: number, y: number } | null = null
  private _paletteDragStart: { x: number, y: number, paletteX: number, paletteY: number } | null = null
  private _pressStartPoint: { x: number, y: number } | null = null
  private _dragPreviewPoint: { x: number, y: number } | null = null
  private _externalLayout = false
  private _disposeToolSubscription: (() => void) | undefined
  private _lastPlacement: ModelerPalettePlacement | null = null

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
    this.addDisposer(app.theme.observe(this, { phase: 'render' }))
    this._restoreLocalRenderBounds()
    this._setupEvents()
  }

  static normalizeProps(props: PaletteProps = {}): PaletteResolvedProps {
    return {
      controller: props.controller,
      placement: props.placement,
      draggable: props.draggable,
      offset: props.offset,
      offsetX: props.offsetX,
      offsetY: props.offsetY,
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
      createRect: () => this._createRect(),
      createBpmnEvent: () => this._createBpmnEvent(),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: PaletteProps): this {
    super.setProps(patch as Partial<PaletteResolvedProps>)
    this.props = Palette.normalizeProps(this.props)
    if (!this._externalLayout) {
      this._syncPaletteFrame()
    }
    return this
  }

  applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    this._externalLayout = true
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
    if (this._draggingItem) {
      this._expandLocalRenderBounds()
    }
    else { this._restoreLocalRenderBounds() }
    if (changed) {
      this.dirty({ matrix: true, update: sizeChanged, render: true })
    }
    return changed
  }

  resolveNovaTooltipTarget(input: { x: number, y: number }): TooltipTargetResolution | null {
    if (!this.props.visible) {
      return null
    }
    const point = this.toLocal(input.x, input.y)
    for (const entry of this._createLayoutPlan(this._resolvePaletteLayoutOptions()).entries) {
      if (entry.type !== 'item') {
        continue
      }
      if (point[0] < entry.x || point[0] > entry.x + entry.size || point[1] < entry.y || point[1] > entry.y + entry.size) {
        continue
      }
      const tooltip = entry.item.tooltip ?? this._resolvePaletteItemTooltip(entry.item)
      if (!tooltip) {
        return null
      }
      return {
        tooltip: typeof tooltip === 'string'
          ? {
              value: tooltip,
              placement: 'cursor',
              delay: 350,
            } as TooltipInput
          : tooltip,
        rect: {
          x: input.x - point[0] + entry.x,
          y: input.y - point[1] + entry.y,
          width: entry.size,
          height: entry.size,
        },
        targetId: entry.item.id,
        targetType: 'modeler.palette.item',
        targetProps: { ...entry.item },
      }
    }
    return null
  }

  measureLayout(_constraints: NovaUiLayoutConstraints): NovaUiLayoutMeasure {
    const plan = this._createLayoutPlan(this._resolvePaletteLayoutOptions())
    return { width: plan.width, height: plan.height }
  }

  update(): void {
    super.update()
    if (!this._externalLayout) {
      this._syncPaletteFrame()
    }
  }

  protected override onMount(): void {
    super.onMount()
    this._subscribeToActiveTool()
  }

  protected override onUnmount(): void {
    this._disposeToolSubscription?.()
    this._disposeToolSubscription = undefined
    super.onUnmount()
  }

  render(): void {
    super.render()
    if (!this.props.visible) {
      this.renderer.schema([] as unknown as NovaSchema)
      return
    }

    const schema: NovaSchema = []
    const layoutOptions = this._resolvePaletteLayoutOptions()
    const plan = this._createLayoutPlan(layoutOptions)
    const width = plan.width
    const height = plan.height

    schema.push({
      type: 'rect',
      x: 0,
      y: 0,
      width,
      height,
      styles: {
        background: this._resolvePaletteColor('paletteBackground'),
        border: {
          color: this._resolvePaletteColor('paletteBorderColor'),
          width: 1,
          radius: 6,
        },
      },
    })

    const context = this._resolveContext()
    const activeToolId = context?.tools.getActiveId() ?? null
    for (const entry of plan.entries) {
      if (entry.type === 'divider') {
        this._appendDivider(schema, entry, layoutOptions)
        continue
      }
      if (entry.type === 'grip') {
        this._appendGrip(schema, entry)
        continue
      }
      const item = entry.item
      const activeBackground = this._pressedItem === item.id || activeToolId === item.toolId
        ? this._resolvePaletteColor('paletteItemPressedBackground')
        : this._hoveredItem === item.id
          ? this._resolvePaletteColor('paletteItemHoverBackground')
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

      this._appendItemIcon(schema, item, entry.x, entry.y, entry.size)
    }

    this._appendDragPreview(schema)
    this.renderer.schema(schema)
  }

  private _setupEvents(): void {
    this.on('mouseenter', (event) => {
      if (!this.props.visible) {
        return
      }
      this._setPaletteCursorFromEvent(event)
      this._hoveredItem = this._resolveItemAtEvent(event)
      this.dirty({ render: true })
    })
    this.on('mousemove', (event) => {
      if (!this.props.visible) {
        return
      }
      this._setPaletteCursorFromEvent(event)
      const next = this._resolveItemAtEvent(event)
      if (next === this._hoveredItem) {
        return
      }
      this._hoveredItem = next
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this._hoveredItem = null
      this._setPaletteCursor(null)
      this.dirty({ render: true })
    })
    this.on('mousedown', (event) => {
      if (!this.props.visible) {
        return false
      }
      if (this._hasPointerModifier(event)) {
        return this._startPassthroughGesture(event)
      }
      const grip = this._resolveGripAtEvent(event)
      if (grip && this._resolvePaletteLayoutOptions().draggable) {
        const point = this.events.getCanvasMousePosition(event)
        this._pressed = true
        this._activeGrip = true
        this._paletteDragStart = { x: point.x, y: point.y, paletteX: this.x, paletteY: this.y }
        this._setPaletteCursor('grip')
        this.nova.cursors.syncPointer({ x: point.x, y: point.y, target: this, pressed: true })
        this.dirty({ render: true })
        return false
      }
      const item = this._resolveItemAtEvent(event)
      if (item && !this._isCreateToolItem(item)) {
        this._runPaletteItem(item)
        this._pressed = false
        this._pressedItem = null
        this._activeDragItem = null
        this._draggingItem = null
        this._dragPreviewPoint = null
        this._pressStartPoint = null
        this.dirty({ render: true })
        return false
      }
      this._pressed = !!item
      this._pressedItem = item
      this._activeDragItem = item
      this._activeGrip = false
      this._draggingItem = null
      this._dragPreviewPoint = null
      this._pressStartPoint = this.events.getCanvasMousePosition(event)
      this.dirty({ render: true })
      return false
    })
    this.on('dragmove', (event) => {
      if (this._activePassthroughGesture) {
        const controller = this._resolveOptionalController()
        if (!controller) {
          return false
        }
        const result = this._activePassthroughGesture.onPointerMove?.(controller.getPluginContext(), event)
        if (result === false) {
          return false
        }
      }
      if (this._activeGrip) {
        this._movePaletteByEvent(event)
        return false
      }
      if (!this._activeDragItem || !this._isCreateToolItem(this._activeDragItem)) {
        return false
      }
      this._dragPreviewPoint = this._resolveLocalEventPoint(event)
      if (this._draggingItem === this._activeDragItem) {
        this.dirty({ render: true })
        return false
      }
      this._draggingItem = this._activeDragItem
      this._expandLocalRenderBounds()
      this.dirty({ render: true })
      return false
    })
    this.on('dragend', (event) => {
      if (this._activePassthroughGesture) {
        const controller = this._resolveOptionalController()
        const gesture = this._activePassthroughGesture
        this._activePassthroughGesture = null
        if (!controller) {
          return false
        }
        gesture.onPointerMove?.(controller.getPluginContext(), event)
        const result = gesture.onPointerUp?.(controller.getPluginContext(), event)
        if (result === false) {
          return false
        }
      }
      if (this._activeDragItem && this._draggingItem) {
        this._createElementAtEvent(this._activeDragItem, event)
      }
      else if (this._activeDragItem) {
        this._runPaletteItem(this._activeDragItem)
      }
      this._resetPressState()
      return false
    })
    this.on('mouseup', (event) => {
      if (this._activePassthroughGesture) {
        const controller = this._resolveOptionalController()
        const gesture = this._activePassthroughGesture
        this._activePassthroughGesture = null
        if (!controller) {
          return false
        }
        gesture.onPointerMove?.(controller.getPluginContext(), event)
        const result = gesture.onPointerUp?.(controller.getPluginContext(), event)
        if (result === false) {
          return false
        }
      }
      if (!this._pressed) {
        return false
      }
      if (this._activeGrip) {
        this._movePaletteByEvent(event)
        this._resetPressState()
        return
      }
      if (this._activeDragItem && this._hasPointerMovedBeyondClick(event)) {
        this._createElementAtEvent(this._activeDragItem, event)
      }
      else if (this._activeDragItem) {
        this._runPaletteItem(this._activeDragItem)
      }
      this._resetPressState()
      this.dirty({ render: true })
      return false
    })
    this.on('click', (event) => {
      if (!this.props.visible) {
        return false
      }
      const item = this._resolveItemAtEvent(event)
      if (item) {
        this._runPaletteItem(item)
      }
      return false
    })
    this.on('dblclick', (event) => {
      if (!this.props.visible) {
        return false
      }
      if (this._resolveGripAtEvent(event)) {
        this._resetDockedPosition()
        return false
      }
      return false
    })
    this.on('dragcancel', () => {
      if (this._activePassthroughGesture) {
        const controller = this._resolveOptionalController()
        if (controller) {
          this._activePassthroughGesture.onCancel?.(controller.getPluginContext())
        }
        this._activePassthroughGesture = null
      }
      this._resetPressState()
    })
  }

  private _subscribeToActiveTool(): void {
    this._disposeToolSubscription?.()
    this._disposeToolSubscription = this._resolveContext()?.tools.subscribe(() => {
      this.dirty({ render: true })
    })
  }

  private _resetPressState(): void {
    this._pressed = false
    this._pressedItem = null
    this._activeDragItem = null
    this._activeGrip = false
    this._paletteDragStart = null
    this._draggingItem = null
    this._pressStartPoint = null
    this._dragPreviewPoint = null
    this._restoreLocalRenderBounds()
    this._setPaletteCursor(null)
    this.dirty({ render: true })
  }

  private _expandLocalRenderBounds(): void {
    this.setLocalRenderBounds({
      x: -this.x,
      y: -this.y,
      width: this.surface.width,
      height: this.surface.height,
    })
  }

  private _restoreLocalRenderBounds(): void {
    this.setLocalRenderBounds({
      x: 0,
      y: 0,
      width: this.width || this.props.width,
      height: this.height || this.props.height,
    })
  }

  private _hasPointerMovedBeyondClick(event: MouseEvent): boolean {
    if (!this._pressStartPoint) {
      return false
    }
    const point = this.events.getCanvasMousePosition(event)
    return Math.abs(point.x - this._pressStartPoint.x) > 2
      || Math.abs(point.y - this._pressStartPoint.y) > 2
  }

  private _hasPointerModifier(event: MouseEvent): boolean {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
  }

  private _setPaletteCursorFromEvent(event: MouseEvent): void {
    if (this._resolveGripAtEvent(event)) {
      this._setPaletteCursor('grip')
      return
    }
    this._setPaletteCursor(this._resolveItemAtEvent(event) ? 'item' : null)
  }

  private _setPaletteCursor(cursor: 'grip' | 'item' | null): void {
    this.options({ cursorContext: { paletteCursor: cursor ?? 'none' } })
  }

  private _startPassthroughGesture(event: MouseEvent): false | void {
    const controller = this._resolveOptionalController()
    if (!controller) {
      return
    }
    const context = controller.getPluginContext()
    const target = controller.hitTest(this.events.getCanvasMousePosition(event))
    for (const gesture of controller.getGestures()) {
      if (!gesture.hitTest?.(context, event, target)) {
        continue
      }
      this._activePassthroughGesture = gesture
      const result = gesture.onPointerDown?.(context, event)
      if (result === false) {
        return false
      }
      return
    }
  }

  private _resolveOptionalController(): ModelerController | undefined {
    return this.props.controller ?? this.injectOptional(MODELER_CONTROLLER)
  }

  private _resolveContext(): ModelerPluginContext | undefined {
    return this._resolveOptionalController()?.getPluginContext()
      ?? this.injectOptional(MODELER_CONTEXT)
  }

  private _createElementAtEvent(itemId: string, event: MouseEvent): void {
    const context = this._resolveContext()
    if (!context) {
      return
    }

    const item = context.palette.get(itemId)
    if (!item?.toolId) {
      return
    }
    const point = this.events.getCanvasMousePosition(event)
    if (!this._isPointInsideCanvas(context, point)) {
      return
    }

    const center = context.screenToWorld(point)
    context.tools.createAt(item.toolId, center)
  }

  private _createRect(): void {
    const context = this._resolveContext()
    if (!context) {
      return
    }

    context.tools.createAt('create:basic.rect', this._resolveInsertCenter(context))
  }

  private _createBpmnEvent(): void {
    const context = this._resolveContext()
    if (!context) {
      return
    }

    context.tools.createAt('create:bpmn.event', this._resolveInsertCenter(context))
  }

  private _runPaletteItem(itemId: string): void {
    const context = this._resolveContext()
    if (!context) {
      return
    }

    const item = context.palette.get(itemId)
    if (!item) {
      return
    }
    if (item.actionId) {
      context.actions.run(item.actionId)
    }
    if (item.toolId) {
      context.tools.activate(item.toolId)
    }
  }

  private _resolveInsertCenter(context: ModelerController | ModelerPluginContext): { x: number, y: number } {
    const layout = context.getLayout()
    return context.screenToWorld({
      x: layout.width / 2,
      y: layout.height / 2,
    })
  }

  private _isPointInsideCanvas(context: ModelerController | ModelerPluginContext, point: { x: number, y: number }): boolean {
    const canvas = context.getLayout().canvas
    return point.x >= canvas.x
      && point.x <= canvas.x + canvas.width
      && point.y >= canvas.y
      && point.y <= canvas.y + canvas.height
  }

  private _syncPaletteFrame(): void {
    const options = this._resolvePaletteLayoutOptions()
    if (this._lastPlacement && this._lastPlacement !== options.placement) {
      this._paletteMode = 'docked'
      this._floatingPosition = null
    }
    this._lastPlacement = options.placement
    if (!options.draggable) {
      this._paletteMode = 'docked'
      this._floatingPosition = null
    }

    const plan = this._createLayoutPlan(options)
    const position = this._paletteMode === 'floating' && this._floatingPosition
      ? this._clampPalettePosition(this._floatingPosition, plan.width, plan.height)
      : this._resolveDockedPosition(options, plan.width, plan.height)
    if (this._paletteMode === 'floating') {
      this._floatingPosition = position
    }

    this.options({
      x: position.x,
      y: position.y,
      width: plan.width,
      height: plan.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
    if (this._draggingItem) {
      this._expandLocalRenderBounds()
    }
    else { this._restoreLocalRenderBounds() }
  }

  private _resolvePaletteLayoutOptions(): PaletteResolvedLayoutOptions {
    const options = this._resolveContext()?.getOptions().palette
    const placement = this.props.placement ?? options?.placement ?? 'left'
    const offset = this._resolvePaletteNumberOption(this.props.offset, options?.offset, 16)
    return {
      placement,
      orientation: placement === 'left' || placement === 'right' ? 'vertical' : 'horizontal',
      draggable: this.props.draggable ?? options?.draggable ?? true,
      offset,
      offsetX: this._resolvePaletteNumberOption(this.props.offsetX, options?.offsetX, offset),
      offsetY: this._resolvePaletteNumberOption(this.props.offsetY, options?.offsetY, offset),
      itemSize: this._resolvePaletteNumberOption(this.props.itemSize, options?.itemSize, 40),
      gap: this._resolvePaletteNumberOption(this.props.gap, options?.gap, 8),
      padding: this._resolvePaletteNumberOption(this.props.padding, options?.padding, 8),
      gripSize: this._resolvePaletteNumberOption(this.props.gripSize, options?.gripSize, 32),
    }
  }

  private _resolvePaletteItemTooltip(item: ModelerPaletteItemDefinition): string | null {
    if (!item.title) {
      return null
    }
    if (item.kind === 'tool' && item.toolId && this._isCreateToolItem(item.id)) {
      return `Create ${item.title}`
    }
    return item.title
  }

  private _resolvePaletteNumberOption(prop: number | undefined, option: number | undefined, fallback: number): number {
    return Math.max(0, finiteNumber(prop, finiteNumber(option, fallback)))
  }

  private _resolveDockedPosition(
    options: PaletteResolvedLayoutOptions,
    width: number,
    height: number,
  ): { x: number, y: number } {
    const surfaceWidth = this.surface.width
    const surfaceHeight = this.surface.height
    if (options.placement === 'right') {
      return {
        x: Math.max(0, surfaceWidth - width - options.offsetX),
        y: options.offsetY,
      }
    }
    if (options.placement === 'top') {
      return { x: options.offsetX, y: options.offsetY }
    }
    if (options.placement === 'bottom') {
      return {
        x: options.offsetX,
        y: Math.max(0, surfaceHeight - height - options.offsetY),
      }
    }
    return { x: options.offsetX, y: options.offsetY }
  }

  private _movePaletteByEvent(event: MouseEvent): void {
    if (!this._paletteDragStart) {
      return
    }
    const point = this.events.getCanvasMousePosition(event)
    const plan = this._createLayoutPlan(this._resolvePaletteLayoutOptions())
    const next = this._clampPalettePosition({
      x: this._paletteDragStart.paletteX + point.x - this._paletteDragStart.x,
      y: this._paletteDragStart.paletteY + point.y - this._paletteDragStart.y,
    }, plan.width, plan.height)
    this._paletteMode = 'floating'
    this._floatingPosition = next
    this.options({ x: next.x, y: next.y })
    this.dirty({ matrix: true, render: true })
  }

  private _resetDockedPosition(): void {
    this._paletteMode = 'docked'
    this._floatingPosition = null
    this._syncPaletteFrame()
    this.dirty({ matrix: true, render: true })
  }

  private _clampPalettePosition(position: { x: number, y: number }, width: number, height: number): { x: number, y: number } {
    return {
      x: clamp(position.x, 0, Math.max(0, this.surface.width - width)),
      y: clamp(position.y, 0, Math.max(0, this.surface.height - height)),
    }
  }

  private _resolveItemAtEvent(event: MouseEvent): string | null {
    const point = this._resolveLocalEventPoint(event)
    return this._resolveItemAtLocalPoint(point.x, point.y)
  }

  private _resolveLocalEventPoint(event: MouseEvent): { x: number, y: number } {
    const { x, y } = this.events.getCanvasMousePosition(event)
    const [localX, localY] = this.toLocal(x, y)
    return { x: localX, y: localY }
  }

  private _resolveItemAtLocalPoint(x: number, y: number): string | null {
    for (const item of this._createLayoutPlan(this._resolvePaletteLayoutOptions()).entries) {
      if (item.type !== 'item') {
        continue
      }
      if (x >= item.x && x <= item.x + item.size && y >= item.y && y <= item.y + item.size) {
        return item.item.id
      }
    }
    return null
  }

  private _resolveGripAtEvent(event: MouseEvent): PaletteGripLayout | null {
    const point = this._resolveLocalEventPoint(event)
    for (const item of this._createLayoutPlan(this._resolvePaletteLayoutOptions()).entries) {
      if (item.type !== 'grip') {
        continue
      }
      if (point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height) {
        return item
      }
    }
    return null
  }

  private _createLayoutPlan(options: PaletteResolvedLayoutOptions): PaletteLayoutPlan {
    const context = this._resolveContext()
    const items = context?.palette.getItems() ?? []
    const layout: Array<PaletteLayoutEntry> = []
    if (options.orientation === 'horizontal') {
      return this._createHorizontalLayoutPlan(items, options, layout)
    }
    return this._createVerticalLayoutPlan(items, options, layout)
  }

  private _createVerticalLayoutPlan(
    items: Array<ModelerPaletteItemDefinition>,
    options: PaletteResolvedLayoutOptions,
    layout: Array<PaletteLayoutEntry>,
  ): PaletteLayoutPlan {
    const width = options.padding * 2 + options.itemSize
    const itemX = options.padding
    let y = options.padding
    const context = this._resolveContext()
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      if (!item) {
        continue
      }
      layout.push({ type: 'item', item, x: itemX, y, size: options.itemSize })
      y += options.itemSize
      const next = items[index + 1]
      const shouldDivide = context?.getOptions().palette?.groups?.[item.group]?.dividerAfter && next?.group !== item.group
      if (shouldDivide) {
        y += options.gap
        layout.push({ type: 'divider', x: options.padding, y, width: options.itemSize, height: 1 })
        y += 1 + options.gap
      }
      else {
        y += options.gap
      }
    }
    if (options.draggable) {
      const gripY = y
      layout.push({ type: 'grip', x: options.padding, y: gripY, width: options.itemSize, height: options.gripSize })
      y += options.gripSize
    }
    else if (layout.length > 0) {
      y -= options.gap
    }
    return { entries: layout, width, height: Math.max(options.padding * 2, y + options.padding) }
  }

  private _createHorizontalLayoutPlan(
    items: Array<ModelerPaletteItemDefinition>,
    options: PaletteResolvedLayoutOptions,
    layout: Array<PaletteLayoutEntry>,
  ): PaletteLayoutPlan {
    const height = options.padding * 2 + options.itemSize
    const itemY = options.padding
    let x = options.padding
    const context = this._resolveContext()
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      if (!item) {
        continue
      }
      layout.push({ type: 'item', item, x, y: itemY, size: options.itemSize })
      x += options.itemSize
      const next = items[index + 1]
      const shouldDivide = context?.getOptions().palette?.groups?.[item.group]?.dividerAfter && next?.group !== item.group
      if (shouldDivide) {
        x += options.gap
        layout.push({ type: 'divider', x, y: options.padding, width: 1, height: options.itemSize })
        x += 1 + options.gap
      }
      else {
        x += options.gap
      }
    }
    if (options.draggable) {
      const gripX = x
      layout.push({ type: 'grip', x: gripX, y: options.padding, width: options.gripSize, height: options.itemSize })
      x += options.gripSize
    }
    else if (layout.length > 0) {
      x -= options.gap
    }
    return { entries: layout, width: Math.max(options.padding * 2, x + options.padding), height }
  }

  private _isCreateToolItem(itemId: string): boolean {
    const context = this._resolveContext()
    const item = context?.palette.get(itemId)
    const tool = item?.toolId ? context?.tools.get(item.toolId) : undefined
    return tool?.kind === 'create-element'
  }

  private _appendDivider(schema: NovaSchema, entry: PaletteDividerLayout, options: PaletteResolvedLayoutOptions): void {
    if (options.orientation === 'horizontal') {
      schema.push({
        type: 'line',
        x1: entry.x,
        y1: entry.y,
        x2: entry.x,
        y2: entry.y + entry.height,
        styles: {
          color: this._resolvePaletteColor('paletteBorderColor'),
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
        color: this._resolvePaletteColor('paletteBorderColor'),
        width: 1,
      },
    })
  }

  private _appendGrip(schema: NovaSchema, entry: PaletteGripLayout): void {
    const color = this._resolvePaletteColor('paletteIconStroke')
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

  private _appendItemIcon(schema: NovaSchema, item: ModelerPaletteItemDefinition, x: number, y: number, size: number): void {
    if (item.icon === 'connect-arrow') {
      this._appendConnectIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-text-annotation') {
      this._appendTextAnnotationIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-group') {
      this._appendGroupIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-data-object') {
      this._appendDataObjectIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-data-store') {
      this._appendDataStoreIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-activity') {
      this._appendBpmnTaskIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-event') {
      this._appendBpmnEventIcon(schema, x, y, size, 'bpmn-event')
      return
    }
    if (item.icon === 'bpmn-swimlane') {
      this._appendSwimlaneIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-association') {
      this._appendAssociationIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-message-flow') {
      this._appendMessageFlowIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'marquee-rect') {
      this._appendMarqueeIcon(schema, x, y, size)
      return
    }
    if (item.icon?.startsWith('bpmn-event')) {
      this._appendBpmnEventIcon(schema, x, y, size, item.icon)
      return
    }
    if (item.icon === 'bpmn-task') {
      this._appendBpmnTaskIcon(schema, x, y, size)
      return
    }
    if (item.icon === 'bpmn-gateway') {
      this._appendBpmnGatewayIcon(schema, x, y, size)
      return
    }
    this._appendRectIcon(schema, x, y, size)
  }

  private _appendConnectIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this._resolvePaletteColor('paletteIconStroke')
    const cy = y + size / 2
    const left = x + size * 0.24
    const right = x + size * 0.76
    schema.push({
      type: 'circle',
      x: left,
      y: cy,
      radius: size * 0.07,
      styles: { background: this._resolvePaletteColor('paletteIconFill'), border: { color, width: 2 } },
    })
    schema.push({ type: 'line', x1: left + size * 0.07, y1: cy, x2: right, y2: cy, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: right, y1: cy, x2: right - size * 0.12, y2: cy - size * 0.1, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: right, y1: cy, x2: right - size * 0.12, y2: cy + size * 0.1, styles: { color, width: 2 } })
  }

  private _appendTextAnnotationIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this._resolvePaletteColor('paletteIconStroke')
    const left = x + size * 0.28
    const top = y + size * 0.25
    const bottom = y + size * 0.75
    schema.push({ type: 'line', x1: left, y1: top, x2: left, y2: bottom, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: left, y1: top, x2: left + size * 0.16, y2: top, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: left, y1: bottom, x2: left + size * 0.16, y2: bottom, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: x + size * 0.48, y1: y + size * 0.36, x2: x + size * 0.72, y2: y + size * 0.36, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: x + size * 0.48, y1: y + size * 0.5, x2: x + size * 0.68, y2: y + size * 0.5, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: x + size * 0.48, y1: y + size * 0.64, x2: x + size * 0.72, y2: y + size * 0.64, styles: { color, width: 2 } })
  }

  private _appendGroupIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this._resolvePaletteColor('paletteIconStroke')
    const left = x + size * 0.24
    const top = y + size * 0.26
    const width = size * 0.52
    const height = size * 0.48
    schema.push({
      type: 'rect',
      x: left,
      y: top,
      width,
      height,
      styles: {
        background: 'rgba(0,0,0,0)',
        border: { color, width: 2, radius: 6 },
      },
    })
    schema.push({ type: 'line', x1: left + width * 0.24, y1: top, x2: left + width * 0.24, y2: top + height, styles: { color, width: 1.5, opacity: 0.72 } })
    schema.push({ type: 'line', x1: left, y1: top + height * 0.5, x2: left + width, y2: top + height * 0.5, styles: { color, width: 1.5, opacity: 0.72 } })
  }

  private _appendDataObjectIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this._resolvePaletteColor('paletteIconStroke')
    const fill = this._resolvePaletteColor('paletteIconFill')
    const left = x + size * 0.31
    const top = y + size * 0.22
    const width = size * 0.38
    const height = size * 0.56
    const fold = size * 0.13
    schema.push({
      type: 'polygon',
      points: [
        { x: left, y: top },
        { x: left + width - fold, y: top },
        { x: left + width, y: top + fold },
        { x: left + width, y: top + height },
        { x: left, y: top + height },
      ],
      styles: { background: fill, stroke: color, lineWidth: 2 },
    })
    schema.push({ type: 'line', x1: left + width - fold, y1: top, x2: left + width - fold, y2: top + fold, styles: { color, width: 1.5 } })
    schema.push({ type: 'line', x1: left + width - fold, y1: top + fold, x2: left + width, y2: top + fold, styles: { color, width: 1.5 } })
  }

  private _appendDataStoreIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this._resolvePaletteColor('paletteIconStroke')
    const left = x + size * 0.25
    const right = x + size * 0.75
    const top = y + size * 0.3
    const bottom = y + size * 0.7
    schema.push({ type: 'line', x1: left, y1: top, x2: right, y2: top, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: left, y1: (top + bottom) / 2, x2: right, y2: (top + bottom) / 2, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: left, y1: bottom, x2: right, y2: bottom, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: left, y1: top, x2: left, y2: bottom, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: right, y1: top, x2: right, y2: bottom, styles: { color, width: 2 } })
  }

  private _appendSwimlaneIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this._resolvePaletteColor('paletteIconStroke')
    const left = x + size * 0.22
    const top = y + size * 0.28
    const width = size * 0.56
    const height = size * 0.44
    schema.push({ type: 'rect', x: left, y: top, width, height, styles: { background: this._resolvePaletteColor('paletteIconFill'), border: { color, width: 2, radius: 1 } } })
    schema.push({ type: 'line', x1: left, y1: top + height / 3, x2: left + width, y2: top + height / 3, styles: { color, width: 1.5 } })
    schema.push({ type: 'line', x1: left, y1: top + height * 2 / 3, x2: left + width, y2: top + height * 2 / 3, styles: { color, width: 1.5 } })
  }

  private _appendAssociationIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = this._resolvePaletteColor('paletteIconStroke')
    const cy = y + size / 2
    const start = x + size * 0.27
    const segment = size * 0.13
    for (let index = 0; index < 3; index += 1) {
      const x1 = start + index * segment * 1.45
      schema.push({ type: 'line', x1, y1: cy, x2: x1 + segment, y2: cy, styles: { color, width: 2 } })
    }
  }

  private _appendMessageFlowIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    this._appendAssociationIcon(schema, x, y, size)
    const color = this._resolvePaletteColor('paletteIconStroke')
    const cy = y + size / 2
    const right = x + size * 0.76
    schema.push({ type: 'line', x1: right, y1: cy, x2: right - size * 0.1, y2: cy - size * 0.09, styles: { color, width: 2 } })
    schema.push({ type: 'line', x1: right, y1: cy, x2: right - size * 0.1, y2: cy + size * 0.09, styles: { color, width: 2 } })
  }

  private _appendRectIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const iconWidth = Math.round(size * 0.58)
    const iconHeight = Math.round(size * 0.38)
    schema.push({
      type: 'rect',
      x: x + (size - iconWidth) / 2,
      y: y + (size - iconHeight) / 2,
      width: iconWidth,
      height: iconHeight,
      styles: {
        background: this._resolvePaletteColor('paletteIconFill'),
        border: {
          color: this._resolvePaletteColor('paletteIconStroke'),
          width: 2,
          radius: 4,
        },
      },
    })
  }

  private _appendBpmnEventIcon(schema: NovaSchema, x: number, y: number, size: number, icon: string): void {
    const strokeWidth = icon === 'bpmn-event-end' ? 3 : 2
    const radius = Math.max(0, size * 0.24)
    schema.push({
      type: 'circle',
      x: x + size / 2,
      y: y + size / 2,
      radius,
      styles: {
        background: this._resolvePaletteColor('paletteIconFill'),
        border: {
          color: this._resolvePaletteColor('paletteIconStroke'),
          width: strokeWidth,
        },
      },
    })
    if (icon !== 'bpmn-event-intermediate') {
      return
    }
    schema.push({
      type: 'circle',
      x: x + size / 2,
      y: y + size / 2,
      radius: Math.max(0, radius - 3),
      styles: {
        background: 'rgba(0,0,0,0)',
        border: {
          color: this._resolvePaletteColor('paletteIconStroke'),
          width: 2,
        },
      },
    })
  }

  private _appendBpmnTaskIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const iconWidth = Math.round(size * 0.64)
    const iconHeight = Math.round(size * 0.42)
    schema.push({
      type: 'rect',
      x: x + (size - iconWidth) / 2,
      y: y + (size - iconHeight) / 2,
      width: iconWidth,
      height: iconHeight,
      styles: {
        background: this._resolvePaletteColor('paletteIconFill'),
        border: {
          color: this._resolvePaletteColor('paletteIconStroke'),
          width: 2,
          radius: 6,
        },
      },
    })
  }

  private _appendBpmnGatewayIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const radius = Math.round(size * 0.28)
    const centerX = x + size / 2
    const centerY = y + size / 2
    schema.push({
      type: 'polygon',
      points: [
        { x: centerX, y: centerY - radius },
        { x: centerX + radius, y: centerY },
        { x: centerX, y: centerY + radius },
        { x: centerX - radius, y: centerY },
      ],
      styles: {
        background: this._resolvePaletteColor('paletteIconFill'),
        stroke: this._resolvePaletteColor('paletteIconStroke'),
        lineWidth: 2,
      },
    })
  }

  private _appendMarqueeIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const left = x + size * 0.24
    const top = y + size * 0.24
    const right = x + size * 0.76
    const bottom = y + size * 0.76
    const color = this._resolvePaletteColor('paletteIconStroke')
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

  private _appendDragPreview(schema: NovaSchema): void {
    if (!this._draggingItem || !this._dragPreviewPoint) {
      return
    }

    const context = this._resolveContext()
    const scale = context?.getViewport().scale ?? 1
    const item = context?.palette.get(this._draggingItem)
    const shape = this._resolveDragPreviewShape(item)

    if (shape === 'bpmn-gateway') {
      const size = 56 * scale
      const half = size / 2
      const centerX = this._dragPreviewPoint.x
      const centerY = this._dragPreviewPoint.y
      schema.push({
        type: 'polygon',
        points: [
          { x: centerX, y: centerY - half },
          { x: centerX + half, y: centerY },
          { x: centerX, y: centerY + half },
          { x: centerX - half, y: centerY },
        ],
        styles: {
          background: this._resolvePaletteColor('palettePreviewFill'),
          stroke: this._resolvePaletteColor('palettePreviewStroke'),
          lineWidth: 1.5,
          opacity: this._resolvePaletteNumber('palettePreviewOpacity'),
        },
      })
      return
    }

    if (shape === 'basic-rect') {
      const width = 160 * scale
      const height = 96 * scale
      schema.push({
        type: 'rect',
        x: this._dragPreviewPoint.x - width / 2,
        y: this._dragPreviewPoint.y - height / 2,
        width,
        height,
        styles: {
          background: this._resolvePaletteColor('palettePreviewFill'),
          border: {
            color: this._resolvePaletteColor('palettePreviewStroke'),
            width: 1.5,
            radius: 6,
          },
          opacity: this._resolvePaletteNumber('palettePreviewOpacity'),
        },
      })
      return
    }

    if (shape === 'bpmn-text-annotation') {
      const width = 160 * scale
      const height = 80 * scale
      const x = this._dragPreviewPoint.x - width / 2
      const y = this._dragPreviewPoint.y - height / 2
      const color = this._resolvePaletteColor('palettePreviewStroke')
      const opacity = this._resolvePaletteNumber('palettePreviewOpacity')
      schema.push({ type: 'line', x1: x, y1: y, x2: x, y2: y + height, styles: { color, width: 1.5, opacity } })
      schema.push({ type: 'line', x1: x, y1: y, x2: x + 14 * scale, y2: y, styles: { color, width: 1.5, opacity } })
      schema.push({ type: 'line', x1: x, y1: y + height, x2: x + 14 * scale, y2: y + height, styles: { color, width: 1.5, opacity } })
      return
    }

    if (shape === 'bpmn-group') {
      const width = 240 * scale
      const height = 160 * scale
      schema.push({
        type: 'rect',
        x: this._dragPreviewPoint.x - width / 2,
        y: this._dragPreviewPoint.y - height / 2,
        width,
        height,
        styles: {
          background: 'rgba(0,0,0,0)',
          border: {
            color: this._resolvePaletteColor('palettePreviewStroke'),
            width: 1.5,
            radius: 4,
            dashPattern: [6, 4],
          },
          opacity: this._resolvePaletteNumber('palettePreviewOpacity'),
        },
      })
      return
    }

    if (shape === 'bpmn-swimlane') {
      const width = 260 * scale
      const height = 140 * scale
      const left = this._dragPreviewPoint.x - width / 2
      const top = this._dragPreviewPoint.y - height / 2
      const color = this._resolvePaletteColor('palettePreviewStroke')
      const opacity = this._resolvePaletteNumber('palettePreviewOpacity')
      schema.push({
        type: 'rect',
        x: left,
        y: top,
        width,
        height,
        styles: {
          background: this._resolvePaletteColor('palettePreviewFill'),
          border: { color, width: 1.5, radius: 4 },
          opacity,
        },
      })
      schema.push({ type: 'line', x1: left + 18 * scale, y1: top, x2: left + 18 * scale, y2: top + height, styles: { color, width: 1.5, opacity } })
      schema.push({ type: 'line', x1: left + 70 * scale, y1: top, x2: left + 70 * scale, y2: top + height, styles: { color, width: 1.5, opacity } })
      schema.push({ type: 'line', x1: left + 18 * scale, y1: top + height / 2, x2: left + width, y2: top + height / 2, styles: { color, width: 1.5, opacity } })
      return
    }

    if (shape === 'bpmn-data-object') {
      const width = 96 * scale
      const height = 120 * scale
      const fold = 16 * scale
      const left = this._dragPreviewPoint.x - width / 2
      const top = this._dragPreviewPoint.y - height / 2
      const right = left + width
      schema.push({
        type: 'polygon',
        points: [
          { x: left, y: top },
          { x: right - fold, y: top },
          { x: right, y: top + fold },
          { x: right, y: top + height },
          { x: left, y: top + height },
        ],
        styles: {
          background: this._resolvePaletteColor('palettePreviewFill'),
          stroke: this._resolvePaletteColor('palettePreviewStroke'),
          lineWidth: 1.5,
          opacity: this._resolvePaletteNumber('palettePreviewOpacity'),
        },
      })
      return
    }

    if (shape === 'bpmn-data-store') {
      const width = 120 * scale
      const height = 96 * scale
      schema.push({
        type: 'rect',
        x: this._dragPreviewPoint.x - width / 2,
        y: this._dragPreviewPoint.y - height / 2,
        width,
        height,
        styles: {
          background: this._resolvePaletteColor('palettePreviewFill'),
          border: {
            color: this._resolvePaletteColor('palettePreviewStroke'),
            width: 1.5,
            radius: 18 * scale,
          },
          opacity: this._resolvePaletteNumber('palettePreviewOpacity'),
        },
      })
      return
    }

    if (shape === 'bpmn-task' || shape === 'bpmn-activity') {
      const width = 120 * scale
      const height = 80 * scale
      schema.push({
        type: 'rect',
        x: this._dragPreviewPoint.x - width / 2,
        y: this._dragPreviewPoint.y - height / 2,
        width,
        height,
        styles: {
          background: this._resolvePaletteColor('palettePreviewFill'),
          border: {
            color: this._resolvePaletteColor('palettePreviewStroke'),
            width: 1.5,
            radius: 10,
          },
          opacity: this._resolvePaletteNumber('palettePreviewOpacity'),
        },
      })
      return
    }

    const radius = (48 * scale) / 2
    schema.push({
      type: 'circle',
      x: this._dragPreviewPoint.x,
      y: this._dragPreviewPoint.y,
      radius,
      styles: {
        background: this._resolvePaletteColor('palettePreviewFill'),
        border: {
          color: this._resolvePaletteColor('palettePreviewStroke'),
          width: 1.5,
        },
        opacity: this._resolvePaletteNumber('palettePreviewOpacity'),
      },
    })
  }

  private _resolveDragPreviewShape(item: ModelerPaletteItemDefinition | undefined): PaletteDragPreviewShape {
    const id = this._draggingItem ?? item?.id ?? ''
    const icon = item?.icon ?? ''
    const toolId = item?.toolId ?? ''
    const actionId = item?.actionId ?? ''
    const signature = `${id} ${icon} ${toolId} ${actionId}`
    if (signature.includes('bpmn.textAnnotation') || icon === 'bpmn-text-annotation') {
      return 'bpmn-text-annotation'
    }
    if (signature.includes('bpmn.group') || icon === 'bpmn-group') {
      return 'bpmn-group'
    }
    if (signature.includes('bpmn.swimlane') || signature.includes('bpmn.participant') || icon === 'bpmn-swimlane') {
      return 'bpmn-swimlane'
    }
    if (signature.includes('bpmn.dataObject') || icon === 'bpmn-data-object') {
      return 'bpmn-data-object'
    }
    if (signature.includes('bpmn.dataStore') || icon === 'bpmn-data-store') {
      return 'bpmn-data-store'
    }
    if (signature.includes('bpmn.gateway') || icon === 'bpmn-gateway') {
      return 'bpmn-gateway'
    }
    if (signature.includes('bpmn.activity') || icon === 'bpmn-activity') {
      return 'bpmn-activity'
    }
    if (signature.includes('bpmn.task') || icon === 'bpmn-task') {
      return 'bpmn-task'
    }
    if (signature.includes('bpmn.event') || icon.startsWith('bpmn-event')) {
      return 'bpmn-event'
    }
    return 'basic-rect'
  }

  private _resolvePaletteColor(token: keyof typeof MODELER_THEME_FALLBACKS): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return String(this.nova.theme.resolve(
      MODELER_THEME_TOKENS[token],
      fallback,
    ) ?? fallback)
  }

  private _resolvePaletteNumber(token: keyof typeof MODELER_THEME_FALLBACKS): number {
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
