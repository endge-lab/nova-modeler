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
import { Modeler } from '@/config/schema.config'
import { MODELER_CONTEXT } from '@/config/context.config'
import type {
  ElementVariantMenuApi,
  ElementVariantMenuDescriptor,
  ElementVariantMenuProps,
  ElementVariantMenuResolvedProps,
  ModelerController,
  ModelerElement,
  ModelerElementVariantControl,
  ModelerElementVariantDraft,
  ModelerElementVariantOption,
  ModelerElementVariantProvider,
  ModelerPluginContext,
  ModelerRect,
} from '@/domain/types'
import type {
  BpmnEventPosition,
  BpmnEventTrigger,
} from '@/elements/bpmn/event/bpmn-event.types'

const MENU_WIDTH = 360
const MENU_PADDING = 16
const TITLE_HEIGHT = 30
const CHOICE_CARD_HEIGHT = 64
const CHOICE_CARD_GAP = 8
const LIST_ROW_HEIGHT = 44
const LIST_VISIBLE_HEIGHT = 220
const CONTROL_LABEL_HEIGHT = 22
const CONTROL_BOTTOM_GAP = 12

@NovaComponent({
  type: Modeler.ElementVariantMenu,
  name: 'ElementVariantMenu',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['controller', 'elementId', 'anchor', 'visible', 'zIndex'],
    render: ['controller', 'elementId', 'visible'],
  },
})
export class ElementVariantMenu<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ElementVariantMenuResolvedProps, ElementVariantMenuApi, Record<string, never>, ElementVariantMenuProps, E> {
  private draft: ModelerElementVariantDraft = {}
  private draftKey: string | null = null
  private hoveredChoiceId: string | null = null
  private hoveredListOptionId: string | null = null
  private scrollY = 0

  @Prop.object<ModelerController>()
  declare controller?: ModelerController

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ElementVariantMenuDescriptor,
    props: ElementVariantMenuResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({
      width: surface.width,
      height: surface.height,
      interactive: props.visible,
      zIndex: props.zIndex,
    })
    this.setupEvents()
  }

  static normalizeProps(props: ElementVariantMenuProps = {}): ElementVariantMenuResolvedProps {
    return {
      controller: props.controller,
      elementId: props.elementId,
      anchor: props.anchor ?? { x: 0, y: 0 },
      visible: props.visible ?? true,
      zIndex: finiteNumber(props.zIndex, 3010),
      onClose: props.onClose,
    }
  }

  override getApi(): ElementVariantMenuApi {
    return {
      close: () => this.close(),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: ElementVariantMenuProps): this {
    super.setProps(patch as Partial<ElementVariantMenuResolvedProps>)
    this.props = ElementVariantMenu.normalizeProps(this.props)
    this.options({
      width: this.surface.width,
      height: this.surface.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
    return this
  }

  update(): void {
    super.update()
    this.options({
      width: this.surface.width,
      height: this.surface.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
  }

  render(): void {
    super.render()
    this.renderer.schema(this.createSchema())
  }

  override containsPoint(x: number, y: number): boolean {
    if (!this.props.visible) return false
    const state = this.resolveState()
    if (!state) return false
    const rect = this.resolveMenuRect(state.descriptor.controls)
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
  }

  private createSchema(): NovaSchema {
    const state = this.resolveState()
    if (!this.props.visible || !state) return []
    const schema: NovaSchema = []
    const rect = this.resolveMenuRect(state.descriptor.controls)
    schema.push({
      type: 'rect',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      styles: {
        background: '#ffffff',
        border: { color: '#d8dee8', width: 1, radius: 8 },
      },
    })
    this.appendText(schema, state.descriptor.title ?? 'Change element', rect.x + MENU_PADDING, rect.y + 12, rect.width - MENU_PADDING * 2, TITLE_HEIGHT, {
      size: 18,
      weight: '700',
      color: '#2f3437',
    })

    let y = rect.y + 12 + TITLE_HEIGHT + 10
    for (const control of state.descriptor.controls) {
      if (control.kind === 'choice') {
        this.appendChoiceControl(schema, control, rect.x + MENU_PADDING, y, rect.width - MENU_PADDING * 2)
        y += this.resolveControlHeight(control)
        continue
      }
      this.appendListControl(schema, state.element, control, rect.x + MENU_PADDING, y, rect.width - MENU_PADDING * 2)
      y += this.resolveControlHeight(control)
    }
    return schema
  }

  private appendChoiceControl(schema: NovaSchema, control: ModelerElementVariantControl, x: number, y: number, width: number): void {
    if (control.title) {
      this.appendText(schema, control.title, x, y, width, 18, { size: 11, weight: '700', color: '#64748b' })
      y += CONTROL_LABEL_HEIGHT
    }
    const cardWidth = Math.max(40, (width - CHOICE_CARD_GAP * Math.max(0, control.options.length - 1)) / Math.max(1, control.options.length))
    for (let index = 0; index < control.options.length; index += 1) {
      const option = control.options[index]
      if (!option) continue
      const selected = option.selected || control.value === option.id
      const hovered = this.hoveredChoiceId === option.id
      const cardX = x + index * (cardWidth + CHOICE_CARD_GAP)
      schema.push({
        type: 'rect',
        x: cardX,
        y,
        width: cardWidth,
        height: CHOICE_CARD_HEIGHT,
        styles: {
          background: selected ? '#e8f3ff' : hovered ? '#f2f5f8' : 'rgba(0,0,0,0)',
          border: { color: selected ? '#1683ff' : 'rgba(0,0,0,0)', width: selected ? 1 : 0, radius: 6 },
        },
      })
      this.appendEventPreview(schema, { id: 'preview', type: 'bpmn.event', x: 0, y: 0, width: 48, height: 48, data: {}, style: {} }, option, cardX + (cardWidth - 32) / 2, y + 7, 32)
      this.appendText(schema, option.title, cardX + 4, y + 42, cardWidth - 8, 18, {
        size: 13,
        weight: selected ? '700' : '600',
        color: '#2f3437',
      }, { align: 'center' })
    }
  }

  private appendListControl(
    schema: NovaSchema,
    element: ModelerElement,
    control: ModelerElementVariantControl,
    x: number,
    y: number,
    width: number,
  ): void {
    if (control.title) {
      this.appendText(schema, control.title, x, y, width, 18, { size: 11, weight: '700', color: '#64748b' })
      y += CONTROL_LABEL_HEIGHT
    }
    const listHeight = LIST_VISIBLE_HEIGHT
    schema.push({
      type: 'rect',
      x,
      y,
      width,
      height: listHeight,
      styles: {
        background: '#ffffff',
        border: { color: 'rgba(0,0,0,0)', width: 0, radius: 6 },
      },
    })
    const listClip = { x: x + 1, y: y + 1, width: Math.max(0, width - 2), height: Math.max(0, listHeight - 2) }
    const scrollY = clamp(this.scrollY, 0, this.resolveMaxScroll(control))
    const startIndex = Math.max(0, Math.floor(scrollY / LIST_ROW_HEIGHT))
    const endIndex = Math.min(control.options.length, Math.ceil((scrollY + listHeight) / LIST_ROW_HEIGHT))
    for (let index = startIndex; index < endIndex; index += 1) {
      const option = control.options[index]
      const rowY = y + index * LIST_ROW_HEIGHT - scrollY
      if (!option || rowY + LIST_ROW_HEIGHT < y || rowY > y + listHeight) continue
      this.appendListRow(schema, element, option, x + 4, rowY, width - 8, LIST_ROW_HEIGHT, listClip)
    }
    const maxScroll = this.resolveMaxScroll(control)
    if (maxScroll > 0) {
      const thumbHeight = Math.max(28, listHeight * (listHeight / (control.options.length * LIST_ROW_HEIGHT)))
      const thumbY = y + (listHeight - thumbHeight) * (scrollY / maxScroll)
      schema.push({
        type: 'rect',
        x: x + width - 6,
        y: thumbY,
        width: 3,
        height: thumbHeight,
        styles: {
          background: '#cbd5e1',
          border: { color: 'rgba(0,0,0,0)', width: 0, radius: 2 },
        },
      })
    }
    schema.push({
      type: 'border',
      x,
      y,
      width,
      height: listHeight,
      styles: {
        color: '#e5e7eb',
        width: 1,
        radius: 6,
      },
    })
  }

  private appendListRow(
    schema: NovaSchema,
    element: ModelerElement,
    option: ModelerElementVariantOption,
    x: number,
    y: number,
    width: number,
    height: number,
    clip: ModelerRect,
  ): void {
    const startIndex = schema.length
    const selected = option.selected
    const hovered = this.hoveredListOptionId === option.id
    schema.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      styles: {
        background: selected ? '#e8f3ff' : hovered ? '#edf2f7' : 'rgba(0,0,0,0)',
        border: { color: 'rgba(0,0,0,0)', width: 0, radius: 6 },
      },
    })
    this.appendEventPreview(schema, element, option, x + 10, y + (height - 32) / 2, 32)
    this.appendText(schema, option.title, x + 52, y, width - 62, height, {
      size: 15,
      weight: selected ? '700' : '500',
      color: '#3f3f46',
    })
    for (let index = startIndex; index < schema.length; index += 1) {
      const item = schema[index]
      if (item) item.clip = clip
    }
  }

  private appendEventPreview(
    schema: NovaSchema,
    element: ModelerElement,
    option: ModelerElementVariantOption,
    x: number,
    y: number,
    size: number,
  ): void {
    const data = (option.data ?? element.data) as { eventPosition?: BpmnEventPosition; trigger?: BpmnEventTrigger }
    const center = { x: x + size / 2, y: y + size / 2 }
    const radius = size * 0.42
    const position = data.eventPosition ?? 'start'
    schema.push({
      type: 'circle',
      x: center.x,
      y: center.y,
      radius,
      styles: {
        background: '#ffffff',
        border: { color: '#3f3f46', width: position === 'end' ? 4 : 2 },
      },
    })
    if (position === 'intermediate') {
      schema.push({
        type: 'circle',
        x: center.x,
        y: center.y,
        radius: Math.max(0, radius - 3),
        styles: {
          background: 'rgba(0,0,0,0)',
          border: { color: '#3f3f46', width: 2 },
        },
      })
    }
    if (!option.icon) return
    const markerSize = size * 0.46
    schema.push({
      type: 'icon',
      icon: option.icon,
      x: center.x - markerSize / 2,
      y: center.y - markerSize / 2,
      width: markerSize,
      height: markerSize,
      styles: { opacity: 1 },
    })
  }

  private appendText(
    schema: NovaSchema,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style: { size: number; weight: '400' | '500' | '600' | '700' | 'normal' | 'bold'; color: string },
    options: { align?: 'left' | 'center' | 'right' } = {},
  ): void {
    schema.push({
      type: 'text',
      text,
      x,
      y,
      width,
      height,
      styles: {
        color: style.color,
        font: {
          family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          size: style.size,
          weight: style.weight,
        },
        lineHeight: height,
        align: { horizontal: options.align ?? 'left', vertical: 'middle' },
        ellipsis: true,
      },
    })
  }

  private resolveState(): {
    context: ModelerController | ModelerPluginContext
    provider: ModelerElementVariantProvider
    element: ModelerElement
    descriptor: ReturnType<ModelerElementVariantProvider['getDescriptor']>
  } | null {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context || !this.props.elementId) return null
    const element = context.getModel().elements.find(item => item.id === this.props.elementId)
    if (!element) return null
    const pluginContext = resolvePluginContext(context)
    const provider = pluginContext.elementVariants.getProvider(element)
    if (!provider) return null
    const data = element.data ?? {}
    const draftKey = `${element.id}:${element.type}:${data.eventPosition ?? ''}:${data.trigger ?? ''}:${data.direction ?? ''}`
    if (this.draftKey !== draftKey) {
      this.draftKey = draftKey
      this.draft = provider.createDraft?.(pluginContext, element) ?? {}
      this.scrollY = 0
    }
    return {
      context,
      provider,
      element,
      descriptor: provider.getDescriptor(pluginContext, element, this.draft),
    }
  }

  private resolveMenuRect(controls: Array<ModelerElementVariantControl>): ModelerRect {
    const controlsHeight = controls.reduce((sum, control) => sum + this.resolveControlHeight(control), 0)
    const height = MENU_PADDING * 2 + TITLE_HEIGHT + 10 + controlsHeight
    const x = clamp(this.props.anchor.x, 8, Math.max(8, this.surface.width - MENU_WIDTH - 8))
    const y = clamp(this.props.anchor.y + 52, 8, Math.max(8, this.surface.height - height - 8))
    return { x, y, width: MENU_WIDTH, height }
  }

  private resolveControlHeight(control: ModelerElementVariantControl): number {
    const label = control.title ? CONTROL_LABEL_HEIGHT : 0
    if (control.kind === 'choice') return label + CHOICE_CARD_HEIGHT + CONTROL_BOTTOM_GAP
    return label + LIST_VISIBLE_HEIGHT + 8
  }

  private setupEvents(): void {
    this.on('mousemove', event => {
      const hit = this.hitOption(event)
      if (hit.choiceId === this.hoveredChoiceId && hit.listOptionId === this.hoveredListOptionId) return
      this.hoveredChoiceId = hit.choiceId
      this.hoveredListOptionId = hit.listOptionId
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hoveredChoiceId = null
      this.hoveredListOptionId = null
      this.dirty({ render: true })
    })
    this.on('wheel', event => {
      const state = this.resolveState()
      const list = state?.descriptor.controls.find(control => control.kind === 'list')
      if (!list) return false
      event.preventDefault()
      this.scrollY = clamp(this.scrollY + event.deltaY, 0, this.resolveMaxScroll(list))
      const hit = this.hitOption(event)
      this.hoveredChoiceId = hit.choiceId
      this.hoveredListOptionId = hit.listOptionId
      this.dirty({ render: true })
      return false
    })
    this.on('mousedown', event => {
      const state = this.resolveState()
      if (!state) return false
      const hit = this.hitOption(event)
      if (hit.control && hit.option) {
        if (hit.control.kind === 'choice') {
          const nextDraft = state.provider.updateDraft?.(
            resolvePluginContext(state.context),
            state.element,
            this.draft,
            hit.control,
            hit.option,
          ) ?? { ...this.draft, ...(hit.option.data ?? {}) }
          this.draft = nextDraft
          state.provider.apply({
            context: resolvePluginContext(state.context),
            element: state.element,
            draft: nextDraft,
            control: hit.control,
            option: hit.option,
          })
          this.scrollY = 0
          this.dirty({ render: true })
          return false
        }
        state.provider.apply({
          context: resolvePluginContext(state.context),
          element: state.element,
          draft: this.draft,
          control: hit.control,
          option: hit.option,
        })
        this.close()
      }
      return false
    })
  }

  private hitOption(event: MouseEvent): {
    control?: ModelerElementVariantControl
    option?: ModelerElementVariantOption
    choiceId: string | null
    listOptionId: string | null
  } {
    const state = this.resolveState()
    if (!state) return { choiceId: null, listOptionId: null }
    const { x, y } = this.events.getCanvasMousePosition(event)
    const rect = this.resolveMenuRect(state.descriptor.controls)
    let rowY = rect.y + 12 + TITLE_HEIGHT + 10
    for (const control of state.descriptor.controls) {
      if (control.kind === 'choice') {
        rowY += control.title ? CONTROL_LABEL_HEIGHT : 0
        const controlX = rect.x + MENU_PADDING
        const controlWidth = rect.width - MENU_PADDING * 2
        const cardWidth = Math.max(40, (controlWidth - CHOICE_CARD_GAP * Math.max(0, control.options.length - 1)) / Math.max(1, control.options.length))
        for (let index = 0; index < control.options.length; index += 1) {
          const option = control.options[index]
          if (!option) continue
          const cardX = controlX + index * (cardWidth + CHOICE_CARD_GAP)
          if (x >= cardX && x <= cardX + cardWidth && y >= rowY && y <= rowY + CHOICE_CARD_HEIGHT) {
            return { control, option, choiceId: option.id, listOptionId: null }
          }
        }
        rowY += CHOICE_CARD_HEIGHT + CONTROL_BOTTOM_GAP
        continue
      }
      rowY += control.title ? CONTROL_LABEL_HEIGHT : 0
      const listY = rowY
      if (x >= rect.x + MENU_PADDING && x <= rect.x + rect.width - MENU_PADDING && y >= listY && y <= listY + LIST_VISIBLE_HEIGHT) {
        const index = Math.floor((y - listY + this.scrollY) / LIST_ROW_HEIGHT)
        const option = control.options[index]
        if (option) return { control, option, choiceId: null, listOptionId: option.id }
      }
      rowY += LIST_VISIBLE_HEIGHT + 8
    }
    return { choiceId: null, listOptionId: null }
  }

  private resolveMaxScroll(control: ModelerElementVariantControl): number {
    return Math.max(0, control.options.length * LIST_ROW_HEIGHT - LIST_VISIBLE_HEIGHT)
  }

  private close(): void {
    this.props.onClose?.()
  }

}

export const MODELER_ELEMENT_VARIANT_MENU_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ElementVariantMenuResolvedProps,
  ElementVariantMenuApi,
  Record<string, never>,
  ElementVariantMenuProps
>(ElementVariantMenu as never) as ElementVariantMenuDescriptor

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function resolvePluginContext(context: ModelerController | ModelerPluginContext): ModelerPluginContext {
  return 'getPluginContext' in context ? context.getPluginContext() : context
}
