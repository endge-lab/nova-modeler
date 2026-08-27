import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { ColorPickerPreset, ColorPickerValueContext } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type {
  ElementColorMenuApi,
  ElementColorMenuDescriptor,
  ElementColorMenuProps,
  ElementColorMenuResolvedProps,
  ModelerController,
  ModelerElement,
  ModelerElementDefinition,
  ModelerRect,
} from '@/domain/types'
import type {
  BpmnParticipantElement,
  BpmnParticipantLane,
} from '@/elements/bpmn/participant/bpmn-participant.types'
import {
  createNovaDecoratedComponentDescriptor,

  NovaComponent,
  NovaComponentNode,

  NovaTemplateRuntime,
  Prop,
} from '@endge/nova'
import {

  NovaUIKit,
  resolveColorPickerHeight,
} from '@endge/nova-ui-kit'
import { MODELER_CONTEXT } from '@/config/context.config'
import { Modeler } from '@/config/schema.config'
import {
  BPMN_PARTICIPANT_TYPE,
  patchBpmnParticipantLaneStyle,
} from '@/elements/bpmn/participant/bpmn-participant.factory'

const MENU_WIDTH = 300
const MENU_PADDING = 16
const TITLE_HEIGHT = 24
const PICKER_WIDTH = 260

const COLOR_PRESETS: Array<ColorPickerPreset> = [
  { id: 'white', value: '#ffffff', borderColor: '#1f2937' },
  { id: 'blue', value: '#bfdbfe', borderColor: '#1d4ed8' },
  { id: 'amber', value: '#fde68a', borderColor: '#92400e' },
  { id: 'green', value: '#bbf7d0', borderColor: '#166534' },
  { id: 'red', value: '#fecaca', borderColor: '#b91c1c' },
  { id: 'purple', value: '#e9d5ff', borderColor: '#7e22ce' },
]

@NovaComponent({
  type: Modeler.ElementColorMenu,
  name: 'ElementColorMenu',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['controller', 'elementId', 'part', 'anchor', 'visible', 'zIndex'],
    render: ['controller', 'elementId', 'part', 'visible'],
  },
})
export class ElementColorMenu<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ElementColorMenuResolvedProps, ElementColorMenuApi, Record<string, never>, ElementColorMenuProps, E> {
  private readonly _childRuntime: NovaTemplateRuntime<E>
  private _customOpen = false

  @Prop.object<ModelerController>()
  declare controller?: ModelerController

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ElementColorMenuDescriptor,
    props: ElementColorMenuResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this._childRuntime = new NovaTemplateRuntime(this)
    this.options({ width: surface.width, height: surface.height, interactive: props.visible, zIndex: props.zIndex })
  }

  static normalizeProps(props: ElementColorMenuProps = {}): ElementColorMenuResolvedProps {
    return {
      controller: props.controller,
      elementId: props.elementId,
      part: props.part ? { ...props.part } : undefined,
      anchor: props.anchor ?? { x: 0, y: 0 },
      visible: props.visible ?? true,
      zIndex: finiteNumber(props.zIndex, 3010),
      onClose: props.onClose,
    }
  }

  override getApi(): ElementColorMenuApi {
    return {
      close: () => this._close(),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: ElementColorMenuProps): this {
    super.setProps(patch as Partial<ElementColorMenuResolvedProps>)
    this.props = ElementColorMenu.normalizeProps(this.props)
    this.options({ width: this.surface.width, height: this.surface.height, interactive: this.props.visible, zIndex: this.props.zIndex })
    return this
  }

  update(): void {
    super.update()
    this.options({ width: this.surface.width, height: this.surface.height, interactive: this.props.visible, zIndex: this.props.zIndex })
  }

  render(): void {
    super.render()
    this.renderer.schema(this._createSchema())
    this._syncPickerChild()
  }

  override containsPoint(x: number, y: number): boolean {
    if (!this.props.visible || !this._resolveElement()) {
      return false
    }
    const rect = this._resolveMenuRect()
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
  }

  protected override onUnmount(): void {
    this._childRuntime.dispose()
    super.onUnmount()
  }

  private _createSchema(): NovaSchema {
    const element = this._resolveElement()
    if (!this.props.visible || !element) {
      return []
    }
    const rect = this._resolveMenuRect()
    const schema: NovaSchema = [{
      type: 'rect',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      styles: {
        background: '#ffffff',
        border: { color: '#d8dee8', width: 1, radius: 8 },
      },
    }]
    schema.push({
      type: 'text',
      text: this._resolveTitle(),
      x: rect.x + MENU_PADDING,
      y: rect.y + 12,
      width: rect.width - MENU_PADDING * 2,
      height: TITLE_HEIGHT,
      styles: {
        color: '#2f3437',
        font: { family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', size: 16, weight: '700' },
        lineHeight: TITLE_HEIGHT,
        align: { horizontal: 'left', vertical: 'middle' },
        ellipsis: true,
      },
    })
    return schema
  }

  private _syncPickerChild(): void {
    const element = this._resolveElement()
    if (!this.props.visible || !element) {
      this._childRuntime.reconcile([])
      return
    }
    const rect = this._resolveMenuRect()
    this._childRuntime.reconcile([{
      type: NovaUIKit.ColorPicker,
      id: `${this.componentId}:picker`,
      props: {
        x: rect.x + MENU_PADDING,
        y: rect.y + 48,
        width: PICKER_WIDTH,
        height: resolveColorPickerHeight(this._customOpen),
        value: this._resolveValue(element),
        presets: COLOR_PRESETS,
        customOpen: this._customOpen,
        format: 'hex',
        allowAlpha: true,
        onCustomOpenChange: (open: boolean) => {
          this._customOpen = open
          this._syncPickerChild()
          this.dirty({ render: true })
        },
        onCommit: (value: string, context: ColorPickerValueContext) => {
          this._applyColor(value, context)
        },
      },
    }])
  }

  private _applyColor(value: string, context?: ColorPickerValueContext): void {
    const modeler = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const element = this._resolveElement()
    if (!modeler || !element) {
      return
    }
    const lane = this._resolveLane(element)
    if (lane && element.type === BPMN_PARTICIPANT_TYPE) {
      modeler.applyCommand({
        type: 'element.replace',
        id: element.id,
        element: patchBpmnParticipantLaneStyle(element as BpmnParticipantElement, lane.id, { fill: value }),
      })
      return
    }
    if (this._resolveColorMode() === 'stroke') {
      modeler.applyCommand({
        type: 'element.patch',
        id: element.id,
        patch: {
          style: {
            ...(element.style ?? {}),
            stroke: value,
          },
        },
      })
      return
    }
    const presetStroke = context?.source === 'preset' ? context.preset?.borderColor : undefined
    modeler.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        style: {
          ...(element.style ?? {}),
          fill: value,
          ...(presetStroke ? { stroke: presetStroke } : {}),
        },
      },
    })
  }

  private _resolveColorMode(): 'fill' | 'stroke' {
    if (this.props.part?.partType === 'bpmn.swimlane.lane') {
      return 'fill'
    }
    const definition = this._resolveElementDefinition()
    const colorable = definition?.capabilities?.colorable
    if (colorable && colorable.stroke === true && colorable.fill !== true) {
      return 'stroke'
    }
    return 'fill'
  }

  private _resolveElementDefinition(): ModelerElementDefinition | null {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const element = this._resolveElement()
    if (!context || !element) {
      return null
    }
    return context.getElementRegistry().get(element.type) ?? null
  }

  private _resolveElement(): ModelerElement | null {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context || !this.props.elementId) {
      return null
    }
    return context.getModel().elements.find(item => item.id === this.props.elementId) ?? null
  }

  private _resolveLane(element: ModelerElement): BpmnParticipantLane | null {
    if (element.type !== BPMN_PARTICIPANT_TYPE || this.props.part?.partType !== 'bpmn.swimlane.lane') {
      return null
    }
    const participant = element as BpmnParticipantElement
    return participant.data?.lanes.find(lane => lane.id === this.props.part?.partId) ?? null
  }

  private _resolveTitle(): string {
    if (this.props.part?.partType === 'bpmn.swimlane.lane') {
      return 'Lane color'
    }
    return this._resolveColorMode() === 'stroke' ? 'Stroke color' : 'Fill color'
  }

  private _resolveValue(element: ModelerElement): string {
    const lane = this._resolveLane(element)
    if (lane) {
      return lane.style?.fill ?? '#ffffff'
    }
    return this._resolveColorMode() === 'stroke'
      ? element.style?.stroke ?? '#3f3f46'
      : element.style?.fill ?? '#ffffff'
  }

  private _resolveMenuRect(): ModelerRect {
    const height = 64 + resolveColorPickerHeight(this._customOpen)
    const x = clamp(this.props.anchor.x, 8, Math.max(8, this.surface.width - MENU_WIDTH - 8))
    const y = clamp(this.props.anchor.y + 52, 8, Math.max(8, this.surface.height - height - 8))
    return { x, y, width: MENU_WIDTH, height }
  }

  private _close(): void {
    this.props.onClose?.()
  }
}

export const MODELER_ELEMENT_COLOR_MENU_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ElementColorMenuResolvedProps,
  ElementColorMenuApi,
  Record<string, never>,
  ElementColorMenuProps
>(ElementColorMenu as never) as ElementColorMenuDescriptor

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
