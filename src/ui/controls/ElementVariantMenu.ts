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
import { NovaUIKit } from '@endge/nova-ui-kit'
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
const CHOICE_ROW_GAP = 8
const LIST_ROW_HEIGHT = 44
const LIST_ROW_ICON_SIZE = 32
const LIST_ROW_TEXT_HEIGHT = 20
const LIST_VISIBLE_HEIGHT = 220
const LIST_SCROLLBAR_INSET = 4
const CONTROL_LABEL_HEIGHT = 22
const CONTROL_BOTTOM_GAP = 12
const INPUT_HEIGHT = 34
const TOGGLE_HEIGHT = 28
const HEADER_ICON_SIZE = 34
const HEADER_ICON_GAP = 6

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
  private hoveredHeaderOptionId: string | null = null
  private hoveredChoiceId: string | null = null
  private hoveredListOptionId: string | null = null
  private readonly scrollYByControl = new Map<string, number>()

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
    const headerWidth = this.resolveHeaderControlsWidth(state.descriptor.headerControls ?? [])
    this.appendText(schema, state.descriptor.title ?? 'Change element', rect.x + MENU_PADDING, rect.y + 12, rect.width - MENU_PADDING * 2 - headerWidth, TITLE_HEIGHT, {
      size: 18,
      weight: '700',
      color: '#2f3437',
    })
    this.appendHeaderControls(schema, state, rect)

    let y = rect.y + 12 + TITLE_HEIGHT + 10
    for (let index = 0; index < state.descriptor.controls.length; index += 1) {
      const control = state.descriptor.controls[index]
      if (!control) continue
      if (control.kind === 'input') {
        this.appendInputControl(schema, state, control, rect.x + MENU_PADDING, y, rect.width - MENU_PADDING * 2)
        y += this.resolveControlHeight(control)
        continue
      }
      if (control.kind === 'choice') {
        this.appendChoiceControl(schema, state.element, control, rect.x + MENU_PADDING, y, rect.width - MENU_PADDING * 2)
        y += this.resolveControlHeight(control)
        continue
      }
      if (control.kind === 'toggle') {
        const toggles = this.collectToggleRow(state.descriptor.controls, index)
        this.appendToggleRow(schema, state, toggles, rect.x + MENU_PADDING, y, rect.width - MENU_PADDING * 2)
        y += this.resolveToggleRowHeight()
        index += toggles.length - 1
        continue
      }
      this.appendListControl(schema, state.element, control, rect.x + MENU_PADDING, y, rect.width - MENU_PADDING * 2)
      y += this.resolveControlHeight(control)
    }
    return schema
  }

  private appendHeaderControls(
    schema: NovaSchema,
    state: {
      context: ModelerController | ModelerPluginContext
      provider: ModelerElementVariantProvider
      element: ModelerElement
      descriptor: ReturnType<ModelerElementVariantProvider['getDescriptor']>
    },
    rect: ModelerRect,
  ): void {
    const controls = state.descriptor.headerControls ?? []
    if (controls.length === 0) return
    let x = rect.x + rect.width - MENU_PADDING - this.resolveHeaderControlsWidth(controls)
    const y = rect.y + 10
    for (const control of controls) {
      if (control.kind !== 'iconToggle') continue
      for (const option of control.options) {
        const selected = option.selected || control.value === option.id
        const hovered = this.hoveredHeaderOptionId === option.id
        schema.push({
          type: 'rect',
          x,
          y,
          width: HEADER_ICON_SIZE,
          height: HEADER_ICON_SIZE,
          styles: {
            background: selected ? '#e8f3ff' : hovered ? '#edf2f7' : 'rgba(0,0,0,0)',
            border: { color: selected ? '#1683ff' : 'rgba(0,0,0,0)', width: selected ? 1 : 0, radius: 6 },
          },
        })
        this.appendHeaderMarkerIcon(schema, option.id, x, y, HEADER_ICON_SIZE, selected ? '#1683ff' : '#111827')
        x += HEADER_ICON_SIZE + HEADER_ICON_GAP
      }
    }
  }

  private appendHeaderMarkerIcon(
    schema: NovaSchema,
    id: string,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    if (id === 'multiInstanceParallel') {
      for (let index = 0; index < 3; index += 1) {
        const lineX = x + 10 + index * 6
        schema.push({ type: 'line', x1: lineX, y1: y + 8, x2: lineX, y2: y + size - 8, styles: { color, width: 2.2 } })
      }
      return
    }
    if (id === 'multiInstanceSequential') {
      for (let index = 0; index < 3; index += 1) {
        const lineY = y + 10 + index * 6
        schema.push({ type: 'line', x1: x + 8, y1: lineY, x2: x + size - 8, y2: lineY, styles: { color, width: 2.2 } })
      }
      return
    }
    schema.push({
      type: 'arc',
      x: x + size / 2,
      y: y + size / 2,
      radius: 9,
      startAngle: Math.PI * 0.12,
      endAngle: Math.PI * 1.82,
      styles: { color, width: 2.2, lineCap: 'round' },
    })
    schema.push({
      type: 'line',
      x1: x + size - 10,
      y1: y + 13,
      x2: x + size - 5,
      y2: y + 14,
      styles: { color, width: 2.2 },
    })
  }

  private appendInputControl(
    schema: NovaSchema,
    state: {
      context: ModelerController | ModelerPluginContext
      provider: ModelerElementVariantProvider
      element: ModelerElement
    },
    control: ModelerElementVariantControl,
    x: number,
    y: number,
    width: number,
  ): void {
    if (control.title) {
      this.appendText(schema, control.title, x, y, width, 18, { size: 11, weight: '700', color: '#64748b' })
      y += CONTROL_LABEL_HEIGHT
    }
    schema.push({
      type: NovaUIKit.Input,
      id: `${this.componentId}:${state.element.id}:${control.id}:input`,
      props: {
        x,
        y,
        width,
        height: INPUT_HEIGHT,
        value: String(control.value ?? ''),
        placeholder: control.placeholder ?? '',
        size: 'sm',
        variant: 'filled',
        selectOnFocus: true,
        onCommit: (value: string) => {
          this.applyInputControl(state, control, value)
        },
      },
    } as never)
  }

  private appendChoiceControl(
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
    const grid = this.resolveChoiceGrid(control, width)
    for (let index = 0; index < control.options.length; index += 1) {
      const option = control.options[index]
      if (!option) continue
      const selected = option.selected || control.value === option.id
      const hovered = this.hoveredChoiceId === option.id
      const col = index % grid.columns
      const row = Math.floor(index / grid.columns)
      const cardX = x + col * (grid.cardWidth + CHOICE_CARD_GAP)
      const cardY = y + row * (CHOICE_CARD_HEIGHT + CHOICE_ROW_GAP)
      schema.push({
        type: 'rect',
        x: cardX,
        y: cardY,
        width: grid.cardWidth,
        height: CHOICE_CARD_HEIGHT,
        styles: {
          background: selected ? '#e8f3ff' : hovered ? '#f2f5f8' : 'rgba(0,0,0,0)',
          border: { color: selected ? '#1683ff' : 'rgba(0,0,0,0)', width: selected ? 1 : 0, radius: 6 },
        },
      })
      this.appendOptionPreview(schema, element, option, cardX + (grid.cardWidth - 32) / 2, cardY + 7, 32)
      this.appendText(schema, option.title, cardX + 4, cardY + 42, grid.cardWidth - 8, 18, {
        size: 13,
        weight: selected ? '700' : '600',
        color: '#2f3437',
      }, { align: 'center' })
    }
  }

  private appendToggleRow(
    schema: NovaSchema,
    state: {
      context: ModelerController | ModelerPluginContext
      provider: ModelerElementVariantProvider
      element: ModelerElement
    },
    controls: Array<ModelerElementVariantControl>,
    x: number,
    y: number,
    width: number,
  ): void {
    const gap = 12
    const controlWidth = Math.max(120, (width - gap * Math.max(0, controls.length - 1)) / Math.max(1, controls.length))
    controls.forEach((control, index) => {
      const enabledOption = control.options.find(option => option.id === 'enabled')
      const disabledOption = control.options.find(option => option.id === 'disabled')
      const checked = enabledOption?.selected === true || control.value === enabledOption?.id || control.value === true
      schema.push({
        type: NovaUIKit.Toggle,
        id: `${this.componentId}:${state.element.id}:${control.id}:toggle`,
        props: {
          x: x + index * (controlWidth + gap),
          y,
          width: controlWidth,
          height: TOGGLE_HEIGHT,
          checked,
          label: control.title ?? enabledOption?.title ?? control.id,
          onChange: (next: boolean) => {
            const option = next ? enabledOption : disabledOption
            if (!option) return
            this.applyInlineControl(state, control, option)
          },
        },
      } as never)
    })
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
    const scrollY = this.resolveControlScrollY(control)
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
      const contentHeight = control.options.length * LIST_ROW_HEIGHT
      const trackHeight = Math.max(1, listHeight - LIST_SCROLLBAR_INSET * 2)
      const thumbHeight = Math.min(trackHeight, Math.max(28, trackHeight * (listHeight / contentHeight)))
      const thumbY = y + LIST_SCROLLBAR_INSET + (trackHeight - thumbHeight) * (scrollY / maxScroll)
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
    this.appendOptionPreview(schema, element, option, x + 10, y + (height - LIST_ROW_ICON_SIZE) / 2, LIST_ROW_ICON_SIZE)
    this.appendText(schema, option.title, x + 52, y + (height - LIST_ROW_TEXT_HEIGHT) / 2, width - 62, LIST_ROW_TEXT_HEIGHT, {
      size: 15,
      weight: selected ? '700' : '500',
      color: '#3f3f46',
    })
    for (let index = startIndex; index < schema.length; index += 1) {
      const item = schema[index]
      if (item) item.clip = clip
    }
  }

  private appendOptionPreview(
    schema: NovaSchema,
    element: ModelerElement,
    option: ModelerElementVariantOption,
    x: number,
    y: number,
    size: number,
  ): void {
    if (this.isConnectionPreview(element, option)) {
      this.appendConnectionPreview(schema, element, option, x, y, size)
      return
    }
    if (this.isActivityPreview(option)) {
      this.appendAssetOptionPreview(schema, option, x, y, size)
      return
    }
    if (element.type === 'bpmn.task') {
      this.appendTaskPreview(schema, element, option, x, y, size)
      return
    }
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

  private appendTaskPreview(
    schema: NovaSchema,
    element: ModelerElement,
    option: ModelerElementVariantOption,
    x: number,
    y: number,
    size: number,
  ): void {
    const data = { ...(element.data ?? {}), ...(option.data ?? {}) } as { taskType?: string }
    const width = size * 0.84
    const height = size * 0.56
    const left = x + (size - width) / 2
    const top = y + (size - height) / 2
    schema.push({
      type: 'rect',
      x: left,
      y: top,
      width,
      height,
      styles: {
        background: '#ffffff',
        border: { color: '#3f3f46', width: 1.5, radius: 5 },
      },
    })
    if (!option.icon || data.taskType === 'none') return
    const iconSize = size * 0.3
    schema.push({
      type: 'icon',
      icon: option.icon,
      x: left + 4,
      y: top + 4,
      width: iconSize,
      height: iconSize,
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
    const draftKey = `${element.id}:${element.type}:${JSON.stringify(data)}`
    if (this.draftKey !== draftKey) {
      this.draftKey = draftKey
      this.draft = provider.createDraft?.(pluginContext, element) ?? {}
      this.scrollYByControl.clear()
    }
    return {
      context,
      provider,
      element,
      descriptor: provider.getDescriptor(pluginContext, element, this.draft),
    }
  }

  private isConnectionPreview(element: ModelerElement, option: ModelerElementVariantOption): boolean {
    return element.type === 'bpmn.flow'
      || element.type === 'bpmn.association'
      || option.data?.connectionFamily === 'flow'
      || option.data?.connectionFamily === 'association'
  }

  private isActivityPreview(option: ModelerElementVariantOption): boolean {
    return typeof option.data?.activityKind === 'string'
  }

  private appendAssetOptionPreview(
    schema: NovaSchema,
    option: ModelerElementVariantOption,
    x: number,
    y: number,
    size: number,
  ): void {
    if (!option.icon) return
    const iconSize = size * 0.8
    schema.push({
      type: 'icon',
      icon: option.icon,
      x: x + (size - iconSize) / 2,
      y: y + (size - iconSize) / 2,
      width: iconSize,
      height: iconSize,
      styles: { opacity: 1 },
    })
  }

  private appendConnectionPreview(
    schema: NovaSchema,
    element: ModelerElement,
    option: ModelerElementVariantOption,
    x: number,
    y: number,
    size: number,
  ): void {
    const data = { ...(element.data ?? {}), ...(option.data ?? {}) }
    const family = data.connectionFamily === 'association' || element.type === 'bpmn.association'
      ? 'association'
      : 'flow'
    const start = { x: x + 4, y: y + size / 2 }
    const end = { x: x + size - 4, y: y + size / 2 }
    const color = '#3f3f46'
    const width = 2
    schema.push({
      type: 'line',
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      styles: {
        color,
        width,
        dashPattern: family === 'association' ? [4, 4] : undefined,
      },
    })
    if (family === 'association') {
      const associationType = data.associationType
      if (associationType === 'directed' || associationType === 'bidirectional' || associationType === 'data') {
        this.appendOpenArrowPreview(schema, end, start, color, width)
      }
      if (associationType === 'bidirectional') this.appendOpenArrowPreview(schema, start, end, color, width)
      return
    }
    this.appendFilledArrowPreview(schema, end, start, color, width)
    if (data.flowType === 'conditionalSequence') {
      const center = { x: start.x + 8, y: start.y }
      schema.push({
        type: 'polygon',
        points: [
          { x: center.x, y: center.y - 5 },
          { x: center.x + 5, y: center.y },
          { x: center.x, y: center.y + 5 },
          { x: center.x - 5, y: center.y },
        ],
        styles: { background: '#ffffff', stroke: color, lineWidth: 1.5 },
      })
    }
    if (data.flowType === 'defaultSequence') {
      schema.push({
        type: 'line',
        x1: start.x + 5,
        y1: start.y + 6,
        x2: start.x + 13,
        y2: start.y - 6,
        styles: { color, width },
      })
    }
  }

  private appendOpenArrowPreview(schema: NovaSchema, point: { x: number; y: number }, previous: { x: number; y: number }, color: string, width: number): void {
    const angle = Math.atan2(point.y - previous.y, point.x - previous.x)
    const length = 8
    const spread = Math.PI / 7
    schema.push({
      type: 'line',
      x1: point.x,
      y1: point.y,
      x2: point.x - Math.cos(angle - spread) * length,
      y2: point.y - Math.sin(angle - spread) * length,
      styles: { color, width },
    })
    schema.push({
      type: 'line',
      x1: point.x,
      y1: point.y,
      x2: point.x - Math.cos(angle + spread) * length,
      y2: point.y - Math.sin(angle + spread) * length,
      styles: { color, width },
    })
  }

  private appendFilledArrowPreview(schema: NovaSchema, point: { x: number; y: number }, previous: { x: number; y: number }, color: string, width: number): void {
    const angle = Math.atan2(point.y - previous.y, point.x - previous.x)
    const length = 9
    const spread = Math.PI / 7
    schema.push({
      type: 'polygon',
      points: [
        point,
        {
          x: point.x - Math.cos(angle - spread) * length,
          y: point.y - Math.sin(angle - spread) * length,
        },
        {
          x: point.x - Math.cos(angle + spread) * length,
          y: point.y - Math.sin(angle + spread) * length,
        },
      ],
      styles: { background: color, stroke: color, lineWidth: width },
    })
  }

  private resolveMenuRect(controls: Array<ModelerElementVariantControl>): ModelerRect {
    const controlsHeight = this.resolveControlsHeight(controls)
    const height = MENU_PADDING * 2 + TITLE_HEIGHT + 10 + controlsHeight
    const x = clamp(this.props.anchor.x, 8, Math.max(8, this.surface.width - MENU_WIDTH - 8))
    const y = clamp(this.props.anchor.y + 52, 8, Math.max(8, this.surface.height - height - 8))
    return { x, y, width: MENU_WIDTH, height }
  }

  private resolveControlHeight(control: ModelerElementVariantControl): number {
    const label = control.title ? CONTROL_LABEL_HEIGHT : 0
    if (control.kind === 'input') return label + INPUT_HEIGHT + CONTROL_BOTTOM_GAP
    if (control.kind === 'choice') {
      const width = MENU_WIDTH - MENU_PADDING * 2
      const grid = this.resolveChoiceGrid(control, width)
      return label + grid.rows * CHOICE_CARD_HEIGHT + Math.max(0, grid.rows - 1) * CHOICE_ROW_GAP + CONTROL_BOTTOM_GAP
    }
    if (control.kind === 'toggle') return this.resolveToggleRowHeight()
    if (control.kind === 'iconToggle') return 0
    return label + LIST_VISIBLE_HEIGHT
  }

  private resolveControlsHeight(controls: Array<ModelerElementVariantControl>): number {
    let height = 0
    for (let index = 0; index < controls.length; index += 1) {
      const control = controls[index]
      if (!control) continue
      if (control.kind === 'toggle') {
        const toggles = this.collectToggleRow(controls, index)
        height += this.resolveToggleRowHeight()
        index += toggles.length - 1
        continue
      }
      height += this.resolveControlHeight(control)
    }
    return height
  }

  private resolveToggleRowHeight(): number {
    return TOGGLE_HEIGHT + CONTROL_BOTTOM_GAP
  }

  private collectToggleRow(
    controls: Array<ModelerElementVariantControl>,
    startIndex: number,
  ): Array<ModelerElementVariantControl> {
    const row: Array<ModelerElementVariantControl> = []
    for (let index = startIndex; index < controls.length; index += 1) {
      const control = controls[index]
      if (!control || control.kind !== 'toggle') break
      row.push(control)
    }
    return row
  }

  private resolveHeaderControlsWidth(controls: Array<ModelerElementVariantControl>): number {
    const optionCount = controls.reduce((sum, control) => sum + (control.kind === 'iconToggle' ? control.options.length : 0), 0)
    if (optionCount === 0) return 0
    return optionCount * HEADER_ICON_SIZE + Math.max(0, optionCount - 1) * HEADER_ICON_GAP
  }

  private setupEvents(): void {
    this.on('mousemove', event => {
      const hit = this.hitOption(event)
      if (
        hit.headerOptionId === this.hoveredHeaderOptionId
        && hit.choiceId === this.hoveredChoiceId
        && hit.listOptionId === this.hoveredListOptionId
      ) return
      this.hoveredHeaderOptionId = hit.headerOptionId
      this.hoveredChoiceId = hit.choiceId
      this.hoveredListOptionId = hit.listOptionId
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hoveredHeaderOptionId = null
      this.hoveredChoiceId = null
      this.hoveredListOptionId = null
      this.dirty({ render: true })
    })
    this.on('wheel', event => {
      const state = this.resolveState()
      const list = state ? this.hitListControl(state.descriptor.controls, event) : null
      if (!list) return false
      event.preventDefault()
      this.setControlScrollY(list, this.resolveControlScrollY(list) + event.deltaY)
      const hit = this.hitOption(event)
      this.hoveredHeaderOptionId = hit.headerOptionId
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
        if (hit.control.kind === 'choice' || hit.control.kind === 'iconToggle') {
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
          this.scrollYByControl.clear()
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
    headerOptionId: string | null
    choiceId: string | null
    listOptionId: string | null
  } {
    const state = this.resolveState()
    if (!state) return { headerOptionId: null, choiceId: null, listOptionId: null }
    const { x, y } = this.events.getCanvasMousePosition(event)
    const rect = this.resolveMenuRect(state.descriptor.controls)
    const headerHit = this.hitHeaderOption(state.descriptor.headerControls ?? [], rect, x, y)
    if (headerHit) return { ...headerHit, headerOptionId: headerHit.option.id, choiceId: null, listOptionId: null }
    let rowY = rect.y + 12 + TITLE_HEIGHT + 10
    for (let controlIndex = 0; controlIndex < state.descriptor.controls.length; controlIndex += 1) {
      const control = state.descriptor.controls[controlIndex]
      if (!control) continue
      if (control.kind === 'input') {
        rowY += this.resolveControlHeight(control)
        continue
      }
      if (control.kind === 'toggle') {
        const toggles = this.collectToggleRow(state.descriptor.controls, controlIndex)
        rowY += this.resolveToggleRowHeight()
        controlIndex += toggles.length - 1
        continue
      }
      if (control.kind === 'choice') {
        rowY += control.title ? CONTROL_LABEL_HEIGHT : 0
        const controlX = rect.x + MENU_PADDING
        const controlWidth = rect.width - MENU_PADDING * 2
        const grid = this.resolveChoiceGrid(control, controlWidth)
        for (let index = 0; index < control.options.length; index += 1) {
          const option = control.options[index]
          if (!option) continue
          const col = index % grid.columns
          const row = Math.floor(index / grid.columns)
          const cardX = controlX + col * (grid.cardWidth + CHOICE_CARD_GAP)
          const cardY = rowY + row * (CHOICE_CARD_HEIGHT + CHOICE_ROW_GAP)
          if (x >= cardX && x <= cardX + grid.cardWidth && y >= cardY && y <= cardY + CHOICE_CARD_HEIGHT) {
            return { control, option, headerOptionId: null, choiceId: option.id, listOptionId: null }
          }
        }
        rowY += grid.rows * CHOICE_CARD_HEIGHT + Math.max(0, grid.rows - 1) * CHOICE_ROW_GAP + CONTROL_BOTTOM_GAP
        continue
      }
      rowY += control.title ? CONTROL_LABEL_HEIGHT : 0
      const listY = rowY
      if (x >= rect.x + MENU_PADDING && x <= rect.x + rect.width - MENU_PADDING && y >= listY && y <= listY + LIST_VISIBLE_HEIGHT) {
        const index = Math.floor((y - listY + this.resolveControlScrollY(control)) / LIST_ROW_HEIGHT)
        const option = control.options[index]
        if (option) return { control, option, headerOptionId: null, choiceId: null, listOptionId: option.id }
      }
      rowY += LIST_VISIBLE_HEIGHT + 8
    }
    return { headerOptionId: null, choiceId: null, listOptionId: null }
  }

  private resolveChoiceGrid(
    control: ModelerElementVariantControl,
    width: number,
  ): { columns: number; rows: number; cardWidth: number } {
    const columns = Math.max(1, control.options.length > 4 ? 3 : control.options.length)
    const rows = Math.max(1, Math.ceil(control.options.length / columns))
    return {
      columns,
      rows,
      cardWidth: Math.max(40, (width - CHOICE_CARD_GAP * Math.max(0, columns - 1)) / columns),
    }
  }

  private hitHeaderOption(
    controls: Array<ModelerElementVariantControl>,
    rect: ModelerRect,
    pointerX: number,
    pointerY: number,
  ): { control: ModelerElementVariantControl; option: ModelerElementVariantOption } | null {
    if (controls.length === 0) return null
    let x = rect.x + rect.width - MENU_PADDING - this.resolveHeaderControlsWidth(controls)
    const y = rect.y + 10
    for (const control of controls) {
      if (control.kind !== 'iconToggle') continue
      for (const option of control.options) {
        if (pointerX >= x && pointerX <= x + HEADER_ICON_SIZE && pointerY >= y && pointerY <= y + HEADER_ICON_SIZE) {
          return { control, option }
        }
        x += HEADER_ICON_SIZE + HEADER_ICON_GAP
      }
    }
    return null
  }

  private applyInputControl(
    state: {
      context: ModelerController | ModelerPluginContext
      provider: ModelerElementVariantProvider
      element: ModelerElement
    },
    control: ModelerElementVariantControl,
    value: unknown,
  ): void {
    const option: ModelerElementVariantOption = {
      id: `${control.id}:input`,
      title: String(value ?? ''),
      data: { [control.id]: value },
    }
    const nextDraft = {
      ...this.draft,
      ...(option.data ?? {}),
    }
    this.draft = nextDraft
    state.provider.apply({
      context: resolvePluginContext(state.context),
      element: state.element,
      draft: nextDraft,
      control,
      option,
    })
    this.dirty({ render: true })
  }

  private applyInlineControl(
    state: {
      context: ModelerController | ModelerPluginContext
      provider: ModelerElementVariantProvider
      element: ModelerElement
    },
    control: ModelerElementVariantControl,
    option: ModelerElementVariantOption,
  ): void {
    const nextDraft = state.provider.updateDraft?.(
      resolvePluginContext(state.context),
      state.element,
      this.draft,
      control,
      option,
    ) ?? {
      ...this.draft,
      ...(option.data ?? {}),
    }
    this.draft = nextDraft
    state.provider.apply({
      context: resolvePluginContext(state.context),
      element: state.element,
      draft: nextDraft,
      control,
      option,
    })
    this.dirty({ render: true })
  }

  private resolveMaxScroll(control: ModelerElementVariantControl): number {
    return Math.max(0, control.options.length * LIST_ROW_HEIGHT - LIST_VISIBLE_HEIGHT)
  }

  private resolveControlScrollY(control: ModelerElementVariantControl): number {
    return clamp(this.scrollYByControl.get(control.id) ?? 0, 0, this.resolveMaxScroll(control))
  }

  private setControlScrollY(control: ModelerElementVariantControl, value: number): void {
    this.scrollYByControl.set(control.id, clamp(value, 0, this.resolveMaxScroll(control)))
  }

  private hitListControl(
    controls: Array<ModelerElementVariantControl>,
    event: MouseEvent,
  ): ModelerElementVariantControl | null {
    const { x, y } = this.events.getCanvasMousePosition(event)
    const rect = this.resolveMenuRect(controls)
    let rowY = rect.y + 12 + TITLE_HEIGHT + 10
    for (let controlIndex = 0; controlIndex < controls.length; controlIndex += 1) {
      const control = controls[controlIndex]
      if (!control) continue
      if (control.kind === 'input') {
        rowY += this.resolveControlHeight(control)
        continue
      }
      if (control.kind === 'toggle') {
        const toggles = this.collectToggleRow(controls, controlIndex)
        rowY += this.resolveToggleRowHeight()
        controlIndex += toggles.length - 1
        continue
      }
      if (control.kind === 'choice') {
        rowY += this.resolveControlHeight(control)
        continue
      }
      rowY += control.title ? CONTROL_LABEL_HEIGHT : 0
      if (x >= rect.x + MENU_PADDING && x <= rect.x + rect.width - MENU_PADDING && y >= rowY && y <= rowY + LIST_VISIBLE_HEIGHT) {
        return control
      }
      rowY += LIST_VISIBLE_HEIGHT + 8
    }
    return null
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
