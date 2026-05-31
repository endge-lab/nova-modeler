import {
  NovaComponent,
  NovaComponentNode,
  Prop,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaComponentDescriptor,
  type NovaSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import {
  NOVA_UI_LAYOUT_TARGET,
  type NovaUiInset,
  type NovaUiLayoutConstraints,
  type NovaUiLayoutMeasure,
  type NovaUiLayoutRect,
  type NovaUiPosition,
} from '@endge/nova-ui-kit'
import { Modeler } from '@/config/schema.config'
import { MODELER_CONTEXT } from '@/config/context.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
} from '@/config/theme.config'
import type { ModelerController } from '@/domain/types/index'
import { createBasicRectElement } from '@/elements/basic/rect/basic-rect.factory'

export interface PaletteProps {
  controller?: ModelerController
  x?: number
  y?: number
  width?: number
  height?: number
  position?: NovaUiPosition
  inset?: NovaUiInset
  zIndex?: number
  visible?: boolean
}

export interface PaletteResolvedProps {
  controller?: ModelerController
  x: number
  y: number
  width: number
  height: number
  position: NovaUiPosition
  inset?: NovaUiInset
  zIndex?: number
  visible: boolean
}

export interface PaletteApi {
  createRect(): void
  setProps(patch: PaletteProps): void
  getProps(): Readonly<PaletteResolvedProps>
}

export type PaletteDescriptor = NovaComponentDescriptor<
  PaletteResolvedProps,
  PaletteApi,
  Record<string, never>,
  PaletteProps
>

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

  private hovered = false
  private pressed = false
  private externalLayout = false
  private rectCounter = 0

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
    this.setupEvents()
  }

  static normalizeProps(props: PaletteProps = {}): PaletteResolvedProps {
    return {
      controller: props.controller,
      x: finiteNumber(props.x, 0),
      y: finiteNumber(props.y, 0),
      width: Math.max(0, finiteNumber(props.width, 56)),
      height: Math.max(0, finiteNumber(props.height, 56)),
      position: props.position ?? 'static',
      inset: props.inset,
      zIndex: props.zIndex,
      visible: props.visible ?? true,
    }
  }

  override getApi(): PaletteApi {
    return {
      createRect: () => this.createRect(),
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
    this.setLocalRenderBounds({ x: 0, y: 0, width: rect.width, height: rect.height })
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
    const itemSize = Math.min(40, Math.max(0, width - 16), Math.max(0, height - 16))
    const itemX = (width - itemSize) / 2
    const itemY = (height - itemSize) / 2
    const activeBackground = this.pressed
      ? this.resolvePaletteColor('paletteItemPressedBackground')
      : this.hovered
        ? this.resolvePaletteColor('paletteItemHoverBackground')
        : 'rgba(0,0,0,0)'

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
    schema.push({
      type: 'rect',
      x: itemX,
      y: itemY,
      width: itemSize,
      height: itemSize,
      styles: {
        background: activeBackground,
        border: {
          color: 'rgba(0,0,0,0)',
          width: 0,
          radius: 5,
        },
      },
    })
    this.appendRectIcon(schema, itemX, itemY, itemSize)
    this.renderer.schema(schema)
  }

  private setupEvents(): void {
    this.on('mouseenter', () => {
      if (!this.props.visible) return
      this.hovered = true
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hovered = false
      this.pressed = false
      this.dirty({ render: true })
    })
    this.on('mousedown', () => {
      if (!this.props.visible) return false
      this.pressed = true
      this.createRect()
      this.dirty({ render: true })
      return false
    })
    this.on('mouseup', () => {
      if (!this.pressed) return false
      this.pressed = false
      this.dirty({ render: true })
      return false
    })
  }

  private createRect(): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    if (!context) return

    const layout = context.getLayout()
    const center = context.screenToWorld({
      x: layout.width / 2,
      y: layout.height / 2,
    })
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

  private resolvePaletteColor(token: keyof typeof MODELER_THEME_FALLBACKS): string {
    return this.nova.theme.resolve(
      MODELER_THEME_TOKENS[token],
      MODELER_THEME_FALLBACKS[token],
    ) ?? MODELER_THEME_FALLBACKS[token]
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
