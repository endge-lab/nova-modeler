import {
  Nova,
  NovaComponent,
  NovaComponentNode,
  NovaTemplateRuntime,
  Prop,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaElementSlots,
  type NovaSchema,
  type NovaSurface,
  type NovaTemplateChildSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { NovaUIKit } from '@endge/nova-ui-kit'
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { Modeler } from '@/config/schema.config'
import { MODELER_CONTEXT } from '@/config/context.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
} from '@/config/theme.config'
import type {
  ModelerController,
  ModelerElement,
  ModelerPluginContext,
  ModelerRect,
} from '@/domain/types/index'
import type {
  ContextPadApi,
  ContextPadDescriptor,
  ContextPadEntry,
  ContextPadLayoutSlotProps,
  ContextPadPosition,
  ContextPadProps,
  ContextPadResolvedProps,
  ContextPadSlotProps,
  ContextPadTarget,
} from '@/domain/types/controls/context-pad.types'

@NovaComponent({
  type: Modeler.ContextPad,
  name: 'ContextPad',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['controller', 'placement', 'offset', 'visible', 'zIndex'],
    render: ['controller', 'visible'],
  },
})
export class ContextPad<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ContextPadResolvedProps, ContextPadApi, Record<string, never>, ContextPadProps, E> {
  private readonly childRuntime: NovaTemplateRuntime<E>
  private slots: NovaElementSlots = {}
  private closedForSelectionKey: string | null = null
  private hovered = false
  private hoveredEntryId: string | null = null
  private pressedEntryId: string | null = null
  private variantMenuOpen = false
  private colorMenuOpen = false
  private disposeVariantMenuLayer?: () => void
  private disposeColorMenuLayer?: () => void
  private readonly handleWindowMouseDown = (event: MouseEvent): void => {
    this.closeVariantMenuFromWindowPointer(event)
  }

  private readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    if ((!this.variantMenuOpen && !this.colorMenuOpen) || event.key !== 'Escape') return
    event.preventDefault()
    this.closeOpenMenus()
  }

  @Prop.object<ModelerController>()
  declare controller?: ModelerController

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ContextPadDescriptor,
    props: ContextPadResolvedProps,
    options: { componentId?: string; slots?: NovaElementSlots } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.childRuntime = new NovaTemplateRuntime(this)
    this.slots = options.slots ?? {}
    this.options({
      width: surface.width,
      height: surface.height,
      interactive: props.visible && !this.hasCustomSlots(),
      zIndex: props.zIndex,
    })
    this.setupEvents()
    this.setupWindowEvents()
  }

  static normalizeProps(props: ContextPadProps = {}): ContextPadResolvedProps {
    return {
      controller: props.controller,
      placement: props.placement ?? 'right',
      offset: finiteNumber(props.offset, 12),
      visible: props.visible ?? true,
      zIndex: finiteNumber(props.zIndex, 3000),
    }
  }

  override getApi(): ContextPadApi {
    return {
      close: () => this.close(),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: ContextPadProps): this {
    super.setProps(patch as Partial<ContextPadResolvedProps>)
    this.props = ContextPad.normalizeProps(this.props)
    this.options({
      width: this.surface.width,
      height: this.surface.height,
      interactive: this.props.visible && !this.hasCustomSlots(),
      zIndex: this.props.zIndex,
    })
    this.syncChild()
    return this
  }

  setSlots(slots: NovaElementSlots = {}): this {
    this.slots = { ...slots }
    this.options({ interactive: this.props.visible && !this.hasCustomSlots() })
    this.syncChild()
    return this
  }

  update(): void {
    super.update()
    this.options({
      width: this.surface.width,
      height: this.surface.height,
      interactive: this.props.visible && !this.hasCustomSlots(),
      zIndex: this.props.zIndex,
    })
    this.syncChild()
  }

  render(): void {
    super.render()
    if (this.hasCustomSlots()) {
      this.renderer.schema([])
      this.syncChild()
      return
    }

    this.renderer.schema(this.createDefaultSchema())
  }

  override containsPoint(x: number, y: number): boolean {
    if (this.hasCustomSlots()) return false
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this.resolveTarget(context) : null
    if (!this.props.visible || !target) return false
    if (!context) return false
    const rect = this.resolvePadRect(context, target)
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
  }

  protected override onUnmount(): void {
    this.teardownWindowEvents()
    this.clearDefaultVariantMenu()
    this.clearDefaultColorMenu()
    this.childRuntime.dispose()
    super.onUnmount()
  }

  private syncChild(): void {
    if (!this.hasCustomSlots()) {
      this.childRuntime.reconcile([])
      return
    }

    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this.resolveTarget(context) : null
    if (!this.props.visible || !context || !target) {
      this.childRuntime.reconcile([])
      return
    }

    const position = this.resolvePosition(target)
    const entries = this.createEntries(context, target)
    const slotProps: ContextPadSlotProps = {
      target,
      element: target.element,
      context,
      entries,
      position,
      run: entry => this.runEntry(context, target, entry),
      close: () => this.close(),
    }
    const content = this.resolveContent(slotProps)
    const layout = this.resolveLayout({ ...slotProps, content })
    this.childRuntime.reconcile(layout)
  }

  private resolveTarget(context: ModelerController | ModelerPluginContext): ContextPadTarget | null {
    const model = context.getModel()
    if (model.selection.length !== 1) return null
    const element = model.elements.find(item => item.id === model.selection[0])
    if (!element) return null
    if (this.closedForSelectionKey === `${model.id}:${model.selectionVersion}:${element.id}`) return null
    const topLeft = context.worldToScreen({ x: element.x, y: element.y })
    const bottomRight = context.worldToScreen({
      x: element.x + element.width,
      y: element.y + element.height,
    })
    return {
      type: 'element',
      element,
      screenBounds: {
        x: Math.min(topLeft.x, bottomRight.x),
        y: Math.min(topLeft.y, bottomRight.y),
        width: Math.abs(bottomRight.x - topLeft.x),
        height: Math.abs(bottomRight.y - topLeft.y),
      },
    }
  }

  private resolvePosition(target: ContextPadTarget): ContextPadPosition {
    const width = 136
    const height = 40
    const preferredX = target.screenBounds.x + target.screenBounds.width + this.props.offset
    const preferredY = target.screenBounds.y
    return {
      x: clamp(preferredX, 0, Math.max(0, this.surface.width - width)),
      y: clamp(preferredY, 0, Math.max(0, this.surface.height - height)),
    }
  }

  private createEntries(
    context: ModelerController | ModelerPluginContext,
    target: ContextPadTarget,
  ): Array<ContextPadEntry> {
    const entries: Array<ContextPadEntry> = []
    if (resolvePluginContext(context).elementVariants.hasProvider(target.element)) {
      entries.push({
        id: 'variants',
        title: 'Change element',
        tone: 'default',
      })
    }
    entries.push({
      id: 'delete',
      title: 'Delete',
      tone: 'danger',
    })
    if (this.isColorable(context, target.element)) {
      entries.push({
        id: 'color',
        title: 'Fill color',
        tone: 'default',
      })
    }
    return entries
  }

  private resolveContent(slotProps: ContextPadSlotProps): Array<NovaTemplateChildSchema> {
    const slot = this.resolveContentSlot(slotProps.element)
    if (slot) {
      const schema = Nova.trackNode(this, () => slot(slotProps), { mode: 'append' })
      return Array.isArray(schema) ? schema as Array<NovaTemplateChildSchema> : []
    }
    return this.createDefaultContent(slotProps)
  }

  private resolveLayout(slotProps: ContextPadLayoutSlotProps): Array<NovaTemplateChildSchema> {
    const slot = this.slots.layout
    if (slot) {
      const schema = Nova.trackNode(this, () => slot(slotProps), { mode: 'append' })
      return Array.isArray(schema) ? schema as Array<NovaTemplateChildSchema> : []
    }
    return this.createDefaultLayout(slotProps)
  }

  private resolveContentSlot(element: ModelerElement): ((props: ContextPadSlotProps) => unknown) | undefined {
    return this.slots[`element-${safeSlotName(element.id)}`]
      ?? this.slots[`type-${safeSlotName(element.type)}`]
      ?? this.slots.default
  }

  private createDefaultLayout(slotProps: ContextPadLayoutSlotProps): Array<NovaTemplateChildSchema> {
    return [{
      type: NovaUIKit.Flex,
      id: `${this.componentId}:layout`,
      props: {
        position: 'fixed',
        inset: { left: slotProps.position.x, top: slotProps.position.y },
        row: true,
        gap: 4,
        padding: 4,
        width: this.resolvePadWidth(slotProps.entries),
        height: 48,
        zIndex: this.props.zIndex,
        background: this.resolveColor('contextPadBackground'),
        border: {
          color: this.resolveColor('contextPadBorderColor'),
          width: 1,
          radius: 8,
        },
      },
      children: slotProps.content,
    }]
  }

  private createDefaultContent(slotProps: ContextPadSlotProps): Array<NovaTemplateChildSchema> {
    return slotProps.entries.map(entry => ({
      type: NovaUIKit.Button,
      id: `${this.componentId}:${entry.id}`,
      props: {
        position: 'static',
        width: 40,
        height: 40,
        variant: 'ghost',
        icon: this.resolveEntryIcon(entry),
        iconPlacement: 'only',
        background: 'rgba(0,0,0,0)',
        hoverBackground: entry.tone === 'danger'
          ? this.resolveColor('contextPadDangerHoverBackground')
          : 'rgba(15, 23, 42, 0.08)',
        pressedBackground: entry.tone === 'danger'
          ? this.resolveColor('contextPadDangerPressedBackground')
          : 'rgba(15, 23, 42, 0.12)',
        selected: this.isEntrySelected(entry),
        tooltip: { text: entry.title },
        onPress: () => slotProps.run(entry),
      },
    }))
  }

  private createDefaultSchema(): NovaSchema {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this.resolveTarget(context) : null
    if (!this.props.visible || !context || !target) return []

    const entries = this.createEntries(context, target)
    const layout = this.resolvePadRect(context, target)
    const schema: NovaSchema = [
      {
        type: 'rect',
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        styles: {
          background: this.resolveColor('contextPadBackground'),
          border: {
            color: this.resolveColor('contextPadBorderColor'),
            width: 1,
            radius: 8,
          },
        },
      },
    ]
    entries.forEach((entry, index) => {
      const rect = this.resolveEntryRect(layout, index)
      const selected = this.isEntrySelected(entry)
      const pressed = this.pressedEntryId === entry.id
      const hovered = this.hoveredEntryId === entry.id || (this.hovered && entries.length === 1)
      schema.push({
        type: 'rect',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        styles: {
          background: pressed
            ? this.resolveEntryPressedBackground(entry)
            : selected
              ? 'rgba(22, 131, 255, 0.16)'
              : hovered
                ? this.resolveEntryHoverBackground(entry)
                : 'rgba(0,0,0,0)',
          border: { color: selected ? '#1683ff' : 'rgba(0,0,0,0)', width: selected ? 1 : 0, radius: 6 },
        },
      })
      schema.push({
        type: 'icon',
        icon: this.resolveEntryIcon(entry),
        x: rect.x + 8,
        y: rect.y + 8,
        width: 24,
        height: 24,
        styles: { opacity: 1 },
      })
    })
    return schema
  }

  private resolvePadRect(context: ModelerController | ModelerPluginContext, target: ContextPadTarget): ModelerRect {
    const entries = this.createEntries(context, target)
    const position = this.resolvePosition(target)
    return {
      x: position.x,
      y: position.y,
      width: this.resolvePadWidth(entries),
      height: 48,
    }
  }

  private resolvePadWidth(entries: Array<ContextPadEntry>): number {
    return entries.length * 40 + Math.max(0, entries.length - 1) * 4 + 8
  }

  private resolveEntryRect(layout: ModelerRect, index: number): ModelerRect {
    return {
      x: layout.x + 4 + index * 44,
      y: layout.y + 4,
      width: 40,
      height: 40,
    }
  }

  private resolveEntryIcon(entry: ContextPadEntry) {
    if (entry.id === 'variants') return MODELER_ASSETS.icons.tool
    if (entry.id === 'color') return MODELER_ASSETS.icons.brush
    return MODELER_ASSETS.icons.trash
  }

  private isEntrySelected(entry: ContextPadEntry): boolean {
    return (entry.id === 'variants' && this.variantMenuOpen) || (entry.id === 'color' && this.colorMenuOpen)
  }

  private isColorable(context: ModelerController | ModelerPluginContext, element: ModelerElement): boolean {
    const definition = resolvePluginContext(context).getElementRegistry().get(element.type)
    return definition?.capabilities?.colorable !== false
  }

  private runEntry(
    context: ModelerController | ModelerPluginContext,
    target: ContextPadTarget,
    entry: ContextPadEntry,
  ): void {
    if (entry.id === 'variants') {
      this.variantMenuOpen = !this.variantMenuOpen
      if (this.variantMenuOpen) {
        this.closeColorMenu()
        this.syncDefaultVariantMenu()
      }
      else this.clearDefaultVariantMenu()
      this.syncChild()
      this.dirty({ render: true })
      return
    }
    if (entry.id === 'color') {
      this.colorMenuOpen = !this.colorMenuOpen
      if (this.colorMenuOpen) {
        this.closeVariantMenu()
        this.syncDefaultColorMenu()
      }
      else this.clearDefaultColorMenu()
      this.syncChild()
      this.dirty({ render: true })
      return
    }
    if (entry.id !== 'delete') return
    context.applyCommand({ type: 'element.delete', id: target.element.id })
    this.close()
  }

  private close(): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const model = context?.getModel()
    this.closedForSelectionKey = model?.selection.length === 1
      ? `${model.id}:${model.selectionVersion}:${model.selection[0]}`
      : null
    this.variantMenuOpen = false
    this.colorMenuOpen = false
    this.clearDefaultVariantMenu()
    this.clearDefaultColorMenu()
    this.childRuntime.reconcile([])
    this.dirty({ render: true })
  }

  private syncDefaultVariantMenu(): void {
    if (this.hasCustomSlots()) return
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this.resolveTarget(context) : null
    if (!this.variantMenuOpen || !context || !target) {
      this.clearDefaultVariantMenu()
      return
    }
    const position = this.resolvePosition(target)
    this.clearDefaultVariantMenu()
    this.disposeVariantMenuLayer = resolvePluginContext(context).layers.reconcile('controls', `${this.componentId}:variant-menu`, [{
      type: Modeler.ElementVariantMenu,
      id: `${this.componentId}:variant-menu`,
      props: {
        controller: context,
        elementId: target.element.id,
        anchor: position,
        visible: true,
        zIndex: this.props.zIndex + 1,
        onClose: () => {
          this.closeVariantMenu()
        },
      },
    }])
  }

  private syncDefaultColorMenu(): void {
    if (this.hasCustomSlots()) return
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this.resolveTarget(context) : null
    if (!this.colorMenuOpen || !context || !target) {
      this.clearDefaultColorMenu()
      return
    }
    const position = this.resolvePosition(target)
    this.clearDefaultColorMenu()
    this.disposeColorMenuLayer = resolvePluginContext(context).layers.reconcile('controls', `${this.componentId}:color-menu`, [{
      type: Modeler.ElementColorMenu,
      id: `${this.componentId}:color-menu`,
      props: {
        controller: context,
        elementId: target.element.id,
        anchor: position,
        visible: true,
        zIndex: this.props.zIndex + 1,
        onClose: () => {
          this.closeColorMenu()
        },
      },
    }])
  }

  private closeVariantMenu(): void {
    if (!this.variantMenuOpen && !this.disposeVariantMenuLayer) return
    this.variantMenuOpen = false
    this.clearDefaultVariantMenu()
    this.syncChild()
    this.dirty({ render: true })
  }

  private closeColorMenu(): void {
    if (!this.colorMenuOpen && !this.disposeColorMenuLayer) return
    this.colorMenuOpen = false
    this.clearDefaultColorMenu()
    this.syncChild()
    this.dirty({ render: true })
  }

  private closeOpenMenus(): void {
    this.closeVariantMenu()
    this.closeColorMenu()
  }

  private clearDefaultVariantMenu(): void {
    this.disposeVariantMenuLayer?.()
    this.disposeVariantMenuLayer = undefined
  }

  private clearDefaultColorMenu(): void {
    this.disposeColorMenuLayer?.()
    this.disposeColorMenuLayer = undefined
  }

  private setupWindowEvents(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('mousedown', this.handleWindowMouseDown, true)
    window.addEventListener('keydown', this.handleWindowKeyDown, true)
  }

  private teardownWindowEvents(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('mousedown', this.handleWindowMouseDown, true)
    window.removeEventListener('keydown', this.handleWindowKeyDown, true)
  }

  private closeVariantMenuFromWindowPointer(event: MouseEvent): void {
    if (!this.variantMenuOpen && !this.colorMenuOpen) return
    const { x, y } = this.nova.events.getCanvasMousePosition(event)
    const target = this.nova.events.hitTest(x, y)
    const targetId = target ? String((target as { componentId?: string }).componentId ?? target.id) : ''
    if (targetId === this.componentId || targetId.startsWith(`${this.componentId}:`)) return
    this.closeOpenMenus()
  }

  private setupEvents(): void {
    this.on('mouseenter', () => {
      this.hovered = true
      this.dirty({ render: true })
    })
    this.on('mousemove', event => {
      const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
      const target = context ? this.resolveTarget(context) : null
      if (!context || !target) return
      const hit = this.resolveEntryFromEvent(context, target, event)
      if (hit?.id === this.hoveredEntryId) return
      this.hoveredEntryId = hit?.id ?? null
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hovered = false
      this.hoveredEntryId = null
      this.pressedEntryId = null
      this.dirty({ render: true })
    })
    this.on('mousedown', event => {
      const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
      const target = context ? this.resolveTarget(context) : null
      const entry = context && target ? this.resolveEntryFromEvent(context, target, event) : null
      if (!context || !target || !entry || this.hasCustomSlots()) return
      this.pressedEntryId = entry.id
      this.dirty({ render: true })
      this.runEntry(context, target, entry)
      return false
    })
    this.on('mouseup', () => {
      if (!this.pressedEntryId) return false
      this.pressedEntryId = null
      this.dirty({ render: true })
      return false
    })
  }

  private resolveEntryFromEvent(
    context: ModelerController | ModelerPluginContext,
    target: ContextPadTarget,
    event: MouseEvent,
  ): ContextPadEntry | undefined {
    const { x, y } = this.events.getCanvasMousePosition(event)
    const layout = this.resolvePadRect(context, target)
    const entries = this.createEntries(context, target)
    return entries.find((_entry, index) => {
      const rect = this.resolveEntryRect(layout, index)
      return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
    })
  }

  private resolveEntryHoverBackground(entry: ContextPadEntry): string {
    return entry.tone === 'danger'
      ? this.resolveColor('contextPadDangerHoverBackground')
      : 'rgba(15, 23, 42, 0.08)'
  }

  private resolveEntryPressedBackground(entry: ContextPadEntry): string {
    return entry.tone === 'danger'
      ? this.resolveColor('contextPadDangerPressedBackground')
      : 'rgba(15, 23, 42, 0.12)'
  }

  private resolveColor(token: keyof typeof MODELER_THEME_FALLBACKS): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return String(this.nova.theme.resolve(
      MODELER_THEME_TOKENS[token],
      fallback,
    ) ?? fallback)
  }

  private hasCustomSlots(): boolean {
    return Object.keys(this.slots).length > 0
  }
}

export const MODELER_CONTEXT_PAD_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ContextPadResolvedProps,
  ContextPadApi,
  Record<string, never>,
  ContextPadProps
>(ContextPad as never) as ContextPadDescriptor

function safeSlotName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-')
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function resolvePluginContext(context: ModelerController | ModelerPluginContext): ModelerPluginContext {
  return 'getPluginContext' in context ? context.getPluginContext() : context
}
