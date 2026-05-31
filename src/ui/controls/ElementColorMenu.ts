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
  ElementColorMenuApi,
  ElementColorMenuDescriptor,
  ElementColorMenuProps,
  ElementColorMenuResolvedProps,
  ModelerController,
  ModelerElement,
  ModelerRect,
} from '@/domain/types'

const MENU_WIDTH = 300
const MENU_PADDING = 16
const TITLE_HEIGHT = 24
const PRESET_SIZE = 34
const PRESET_GAP = 12
const CUSTOM_WIDTH = 240
const CUSTOM_HEIGHT = 96
const CUSTOM_COLUMNS = 24
const CUSTOM_ROWS = 10
const HUE_HEIGHT = 12
const ALPHA_HEIGHT = 12
const CONTROL_GAP = 10

const COLOR_PRESETS: Array<{ id: string; fill: string; stroke: string }> = [
  { id: 'white', fill: '#ffffff', stroke: '#1f2937' },
  { id: 'blue', fill: '#bfdbfe', stroke: '#1d4ed8' },
  { id: 'amber', fill: '#fde68a', stroke: '#92400e' },
  { id: 'green', fill: '#bbf7d0', stroke: '#166534' },
  { id: 'red', fill: '#fecaca', stroke: '#b91c1c' },
  { id: 'purple', fill: '#e9d5ff', stroke: '#7e22ce' },
]

@NovaComponent({
  type: Modeler.ElementColorMenu,
  name: 'ElementColorMenu',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['controller', 'elementId', 'anchor', 'visible', 'zIndex'],
    render: ['controller', 'elementId', 'visible'],
  },
})
export class ElementColorMenu<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ElementColorMenuResolvedProps, ElementColorMenuApi, Record<string, never>, ElementColorMenuProps, E> {
  private customHue = 210
  private customSaturation = 0.58
  private customValue = 0.86
  private customAlpha = 1
  private hoveredId: string | null = null

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
    this.options({ width: surface.width, height: surface.height, interactive: props.visible, zIndex: props.zIndex })
    this.setupEvents()
  }

  static normalizeProps(props: ElementColorMenuProps = {}): ElementColorMenuResolvedProps {
    return {
      controller: props.controller,
      elementId: props.elementId,
      anchor: props.anchor ?? { x: 0, y: 0 },
      visible: props.visible ?? true,
      zIndex: finiteNumber(props.zIndex, 3010),
      onClose: props.onClose,
    }
  }

  override getApi(): ElementColorMenuApi {
    return {
      close: () => this.close(),
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
    this.renderer.schema(this.createSchema())
  }

  override containsPoint(x: number, y: number): boolean {
    if (!this.props.visible || !this.resolveElement()) return false
    const rect = this.resolveMenuRect()
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
  }

  private createSchema(): NovaSchema {
    const element = this.resolveElement()
    if (!this.props.visible || !element) return []
    const rect = this.resolveMenuRect()
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
    this.appendText(schema, 'Fill color', rect.x + MENU_PADDING, rect.y + 12, rect.width - MENU_PADDING * 2, TITLE_HEIGHT, {
      size: 16,
      weight: '700',
      color: '#2f3437',
    })
    this.appendPresets(schema, rect.x + MENU_PADDING, rect.y + 48)
    this.appendCustomPicker(schema, rect.x + MENU_PADDING, rect.y + 138)
    return schema
  }

  private appendPresets(schema: NovaSchema, x: number, y: number): void {
    COLOR_PRESETS.forEach((preset, index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
      const swatchX = x + col * (PRESET_SIZE + PRESET_GAP)
      const swatchY = y + row * (PRESET_SIZE + PRESET_GAP)
      const hovered = this.hoveredId === `preset:${preset.id}`
      if (hovered) {
        schema.push({
          type: 'rect',
          x: swatchX - 7,
          y: swatchY - 7,
          width: PRESET_SIZE + 14,
          height: PRESET_SIZE + 14,
          styles: { background: '#f2f5f8', border: { color: 'rgba(0,0,0,0)', width: 0, radius: 6 } },
        })
      }
      schema.push({
        type: 'rect',
        x: swatchX,
        y: swatchY,
        width: PRESET_SIZE,
        height: PRESET_SIZE,
        styles: {
          background: preset.fill,
          border: { color: preset.stroke, width: 3, radius: 4 },
        },
      })
    })
  }

  private appendCustomPicker(schema: NovaSchema, x: number, y: number): void {
    this.appendText(schema, 'Custom', x, y, CUSTOM_WIDTH, 18, { size: 11, weight: '700', color: '#64748b' })
    const pickerY = y + 24
    const cellWidth = CUSTOM_WIDTH / CUSTOM_COLUMNS
    const cellHeight = CUSTOM_HEIGHT / CUSTOM_ROWS
    for (let row = 0; row < CUSTOM_ROWS; row += 1) {
      for (let col = 0; col < CUSTOM_COLUMNS; col += 1) {
        schema.push({
          type: 'rect',
          x: x + col * cellWidth,
          y: pickerY + row * cellHeight,
          width: cellWidth + 0.5,
          height: cellHeight + 0.5,
          styles: {
            background: hsvaToRgbaString(this.customHue, col / (CUSTOM_COLUMNS - 1), 1 - row / (CUSTOM_ROWS - 1), this.customAlpha),
            border: { color: 'rgba(0,0,0,0)', width: 0 },
          },
        })
      }
    }
    schema.push({
      type: 'border',
      x,
      y: pickerY,
      width: CUSTOM_WIDTH,
      height: CUSTOM_HEIGHT,
      styles: { color: '#cbd5e1', width: 1, radius: 5 },
    })
    this.appendHueStrip(schema, x, pickerY + CUSTOM_HEIGHT + CONTROL_GAP)
    this.appendAlphaStrip(schema, x, pickerY + CUSTOM_HEIGHT + CONTROL_GAP + HUE_HEIGHT + CONTROL_GAP)
    const preview = hsvaToRgbaString(this.customHue, this.customSaturation, this.customValue, this.customAlpha)
    schema.push({
      type: 'rect',
      x: x + CUSTOM_WIDTH - 40,
      y: y - 2,
      width: 40,
      height: 20,
      styles: { background: preview, border: { color: '#94a3b8', width: 1, radius: 4 } },
    })
  }

  private appendHueStrip(schema: NovaSchema, x: number, y: number): void {
    const segments = 24
    const segmentWidth = CUSTOM_WIDTH / segments
    for (let index = 0; index < segments; index += 1) {
      schema.push({
        type: 'rect',
        x: x + index * segmentWidth,
        y,
        width: segmentWidth + 0.5,
        height: HUE_HEIGHT,
        styles: { background: hsvaToRgbaString((index / segments) * 360, 1, 1, 1), border: { color: 'rgba(0,0,0,0)', width: 0 } },
      })
    }
  }

  private appendAlphaStrip(schema: NovaSchema, x: number, y: number): void {
    const segments = 16
    const segmentWidth = CUSTOM_WIDTH / segments
    for (let index = 0; index < segments; index += 1) {
      schema.push({
        type: 'rect',
        x: x + index * segmentWidth,
        y,
        width: segmentWidth + 0.5,
        height: ALPHA_HEIGHT,
        styles: {
          background: hsvaToRgbaString(this.customHue, this.customSaturation, this.customValue, index / (segments - 1)),
          border: { color: 'rgba(0,0,0,0)', width: 0 },
        },
      })
    }
  }

  private appendText(
    schema: NovaSchema,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style: { size: number; weight: '400' | '500' | '600' | '700' | 'normal' | 'bold'; color: string },
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
        font: { family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', size: style.size, weight: style.weight },
        lineHeight: height,
        align: { horizontal: 'left', vertical: 'middle' },
        ellipsis: true,
      },
    })
  }

  private setupEvents(): void {
    this.on('mousemove', event => {
      const hit = this.hitOption(event)
      if (hit.id === this.hoveredId) return
      this.hoveredId = hit.id
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hoveredId = null
      this.dirty({ render: true })
    })
    this.on('mousedown', event => {
      const hit = this.hitOption(event)
      if (hit.kind === 'preset' && hit.preset) {
        this.applyFill(hit.preset.fill, hit.preset.stroke)
        return false
      }
      if (hit.kind === 'custom' && hit.color) {
        this.applyFill(hit.color)
        return false
      }
      return false
    })
  }

  private hitOption(event: MouseEvent): {
    id: string | null
    kind?: 'preset' | 'custom'
    preset?: typeof COLOR_PRESETS[number]
    color?: string
  } {
    const { x, y } = this.events.getCanvasMousePosition(event)
    const rect = this.resolveMenuRect()
    const presetX = rect.x + MENU_PADDING
    const presetY = rect.y + 48
    for (let index = 0; index < COLOR_PRESETS.length; index += 1) {
      const preset = COLOR_PRESETS[index]
      if (!preset) continue
      const col = index % 3
      const row = Math.floor(index / 3)
      const swatchX = presetX + col * (PRESET_SIZE + PRESET_GAP)
      const swatchY = presetY + row * (PRESET_SIZE + PRESET_GAP)
      if (x >= swatchX - 7 && x <= swatchX + PRESET_SIZE + 7 && y >= swatchY - 7 && y <= swatchY + PRESET_SIZE + 7) {
        return { id: `preset:${preset.id}`, kind: 'preset', preset }
      }
    }
    const customX = rect.x + MENU_PADDING
    const customY = rect.y + 138 + 24
    if (x >= customX && x <= customX + CUSTOM_WIDTH && y >= customY && y <= customY + CUSTOM_HEIGHT) {
      this.customSaturation = clamp((x - customX) / CUSTOM_WIDTH, 0, 1)
      this.customValue = clamp(1 - (y - customY) / CUSTOM_HEIGHT, 0, 1)
      return { id: 'custom:sv', kind: 'custom', color: hsvaToRgbaString(this.customHue, this.customSaturation, this.customValue, this.customAlpha) }
    }
    const hueY = customY + CUSTOM_HEIGHT + CONTROL_GAP
    if (x >= customX && x <= customX + CUSTOM_WIDTH && y >= hueY && y <= hueY + HUE_HEIGHT) {
      this.customHue = clamp((x - customX) / CUSTOM_WIDTH, 0, 1) * 360
      return { id: 'custom:hue', kind: 'custom', color: hsvaToRgbaString(this.customHue, this.customSaturation, this.customValue, this.customAlpha) }
    }
    const alphaY = hueY + HUE_HEIGHT + CONTROL_GAP
    if (x >= customX && x <= customX + CUSTOM_WIDTH && y >= alphaY && y <= alphaY + ALPHA_HEIGHT) {
      this.customAlpha = clamp((x - customX) / CUSTOM_WIDTH, 0, 1)
      return { id: 'custom:alpha', kind: 'custom', color: hsvaToRgbaString(this.customHue, this.customSaturation, this.customValue, this.customAlpha) }
    }
    return { id: null }
  }

  private applyFill(fill: string, stroke?: string): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const element = this.resolveElement()
    if (!context || !element) return
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        style: {
          ...(element.style ?? {}),
          fill,
          ...(stroke ? { stroke } : {}),
        },
      },
    })
  }

  private resolveElement(): ModelerElement | null {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context || !this.props.elementId) return null
    return context.getModel().elements.find(item => item.id === this.props.elementId) ?? null
  }

  private resolveMenuRect(): ModelerRect {
    const height = 300
    const x = clamp(this.props.anchor.x, 8, Math.max(8, this.surface.width - MENU_WIDTH - 8))
    const y = clamp(this.props.anchor.y + 52, 8, Math.max(8, this.surface.height - height - 8))
    return { x, y, width: MENU_WIDTH, height }
  }

  private close(): void {
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

function hsvaToRgbaString(hue: number, saturation: number, value: number, alpha: number): string {
  const chroma = value * saturation
  const huePrime = ((hue % 360) + 360) % 360 / 60
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1))
  const m = value - chroma
  const [r1, g1, b1] = huePrime < 1
    ? [chroma, x, 0]
    : huePrime < 2
      ? [x, chroma, 0]
      : huePrime < 3
        ? [0, chroma, x]
        : huePrime < 4
          ? [0, x, chroma]
          : huePrime < 5
            ? [x, 0, chroma]
            : [chroma, 0, x]
  const r = Math.round((r1 + m) * 255)
  const g = Math.round((g1 + m) * 255)
  const b = Math.round((b1 + m) * 255)
  const normalizedAlpha = Math.round(clamp(alpha, 0, 1) * 100) / 100
  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`
}
