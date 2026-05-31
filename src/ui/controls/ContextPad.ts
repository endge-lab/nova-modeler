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
  private pressed = false

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

    this.childRuntime.reconcile([])
    this.renderer.schema(this.createDefaultSchema())
  }

  override containsPoint(x: number, y: number): boolean {
    if (this.hasCustomSlots()) return false
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this.resolveTarget(context) : null
    if (!this.props.visible || !target) return false
    const rect = this.resolveButtonRect(target)
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
  }

  protected override onUnmount(): void {
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
    const entries = this.createEntries()
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
    const width = 40
    const height = 40
    const preferredX = target.screenBounds.x + target.screenBounds.width + this.props.offset
    const preferredY = target.screenBounds.y
    return {
      x: clamp(preferredX, 0, Math.max(0, this.surface.width - width)),
      y: clamp(preferredY, 0, Math.max(0, this.surface.height - height)),
    }
  }

  private createEntries(): Array<ContextPadEntry> {
    return [{
      id: 'delete',
      title: 'Delete',
      tone: 'danger',
    }]
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
        width: 48,
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
    const [entry] = slotProps.entries
    if (!entry) return []
    return [{
      type: NovaUIKit.Button,
      id: `${this.componentId}:delete`,
      props: {
        position: 'static',
        width: 40,
        height: 40,
        variant: 'ghost',
        text: entry.title,
        background: 'rgba(0,0,0,0)',
        hoverBackground: this.resolveColor('contextPadDangerHoverBackground'),
        pressedBackground: this.resolveColor('contextPadDangerPressedBackground'),
        tooltip: { text: entry.title },
        onPress: () => slotProps.run(entry),
      },
    }]
  }

  private createDefaultSchema(): NovaSchema {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this.resolveTarget(context) : null
    if (!this.props.visible || !target) return []

    const layout = this.resolveButtonRect(target)
    const activeBackground = this.pressed
      ? this.resolveColor('contextPadDangerPressedBackground')
      : this.hovered
        ? this.resolveColor('contextPadDangerHoverBackground')
        : 'rgba(0,0,0,0)'
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
      {
        type: 'rect',
        x: layout.x + 4,
        y: layout.y + 4,
        width: 40,
        height: 40,
        styles: {
          background: activeBackground,
          border: { color: 'rgba(0,0,0,0)', width: 0, radius: 6 },
        },
      },
    ]
    this.appendTrashIcon(schema, layout.x + 12, layout.y + 12, 24)
    return schema
  }

  private resolveButtonRect(target: ContextPadTarget): ModelerRect {
    const position = this.resolvePosition(target)
    return {
      x: position.x,
      y: position.y,
      width: 48,
      height: 48,
    }
  }

  private runEntry(
    context: ModelerController | ModelerPluginContext,
    target: ContextPadTarget,
    entry: ContextPadEntry,
  ): void {
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
    this.childRuntime.reconcile([])
    this.dirty({ render: true })
  }

  private setupEvents(): void {
    this.on('mouseenter', () => {
      this.hovered = true
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hovered = false
      this.pressed = false
      this.dirty({ render: true })
    })
    this.on('mousedown', () => {
      const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
      const target = context ? this.resolveTarget(context) : null
      const entry = this.createEntries()[0]
      if (!context || !target || !entry || this.hasCustomSlots()) return false
      this.pressed = true
      this.dirty({ render: true })
      this.runEntry(context, target, entry)
      return false
    })
    this.on('mouseup', () => {
      if (!this.pressed) return false
      this.pressed = false
      this.dirty({ render: true })
      return false
    })
  }

  private appendTrashIcon(schema: NovaSchema, x: number, y: number, size: number): void {
    const color = '#dc2626'
    const scale = size / 24
    const tx = (value: number) => x + value * scale
    const ty = (value: number) => y + value * scale
    schema.push(
      { type: 'line', x1: tx(4), y1: ty(7), x2: tx(20), y2: ty(7), styles: { color, width: 2 } },
      { type: 'line', x1: tx(10), y1: ty(11), x2: tx(10), y2: ty(17), styles: { color, width: 2 } },
      { type: 'line', x1: tx(14), y1: ty(11), x2: tx(14), y2: ty(17), styles: { color, width: 2 } },
      { type: 'line', x1: tx(9), y1: ty(7), x2: tx(9), y2: ty(4), styles: { color, width: 2 } },
      { type: 'line', x1: tx(9), y1: ty(4), x2: tx(15), y2: ty(4), styles: { color, width: 2 } },
      { type: 'line', x1: tx(15), y1: ty(4), x2: tx(15), y2: ty(7), styles: { color, width: 2 } },
      { type: 'line', x1: tx(5), y1: ty(7), x2: tx(6), y2: ty(19), styles: { color, width: 2 } },
      { type: 'line', x1: tx(6), y1: ty(19), x2: tx(8), y2: ty(21), styles: { color, width: 2 } },
      { type: 'line', x1: tx(8), y1: ty(21), x2: tx(16), y2: ty(21), styles: { color, width: 2 } },
      { type: 'line', x1: tx(16), y1: ty(21), x2: tx(18), y2: ty(19), styles: { color, width: 2 } },
      { type: 'line', x1: tx(18), y1: ty(19), x2: tx(19), y2: ty(7), styles: { color, width: 2 } },
    )
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
