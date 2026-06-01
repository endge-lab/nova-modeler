import {
  NovaComponent,
  NovaComponentNode,
  boundsContainsPoint,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaComponentDescriptor,
  type NovaSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
} from '@/config/theme.config'
import {
  MODELER_CONTEXT,
  MODELER_STORE,
} from '@/config/context.config'
import type {
  ModelerOverlayPlacement,
  ModelerPoint,
  ModelerRect,
} from '@/domain/types/index'
import {
  createMiniMapLayout,
  createMiniMapSchema,
  type MiniMapLayout,
  type MiniMapTheme,
} from '@/plugins/mini-map/mini-map-schema'

export interface MiniMapProps {
  visible?: boolean
  placement?: ModelerOverlayPlacement
  width?: number
  height?: number
  margin?: number
  position?: 'static' | 'fixed' | 'absolute'
  inset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>
  draggableViewport?: boolean
}

export interface MiniMapResolvedProps {
  visible: boolean
  placement: ModelerOverlayPlacement
  width: number
  height: number
  margin: number
  position: 'static' | 'fixed' | 'absolute'
  inset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>
  draggableViewport: boolean
}

export type MiniMapDescriptor = NovaComponentDescriptor<
  MiniMapResolvedProps,
  Record<string, never>,
  Record<string, never>,
  MiniMapProps
>

@NovaComponent({
  type: Modeler.MiniMap,
  name: 'MiniMap',
  version: '0.22.0',
  dirtyPolicy: {
    update: ['width', 'height', 'position', 'inset', 'placement', 'margin', 'visible'],
    render: ['draggableViewport'],
  },
})
export class MiniMap<E extends EventList = Record<string, any>>
  extends NovaComponentNode<MiniMapResolvedProps, Record<string, never>, Record<string, never>, MiniMapProps, E> {
  private dragging = false

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: MiniMapDescriptor,
    props: MiniMapResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: props.visible, zIndex: 0 })
    this.addDisposer(app.theme.observe(this, { phase: 'render' }))
    this.setupEvents()
  }

  static normalizeProps(props: MiniMapProps = {}): MiniMapResolvedProps {
    return {
      visible: props.visible ?? true,
      placement: props.placement ?? 'bottom-right',
      width: finiteNumber(props.width, 168),
      height: finiteNumber(props.height, 112),
      margin: finiteNumber(props.margin, 16),
      position: props.position ?? 'fixed',
      inset: props.inset,
      draggableViewport: props.draggableViewport ?? true,
    }
  }

  update(): void {
    super.update()
    this.options({
      width: this.surface.width,
      height: this.surface.height,
      interactive: this.props.visible,
    })
  }

  override containsPoint(x: number, y: number): boolean {
    return this.props.visible && boundsContainsPoint(this.resolveMiniMapRect(), x, y)
  }

  render(): void {
    super.render()
    const context = this.inject(MODELER_CONTEXT)
    if (!this.props.visible || !context) {
      this.renderer.schema([] as unknown as NovaSchema)
      return
    }
    this.renderer.schema(createMiniMapSchema(this.resolveLayout(), this.resolveTheme()))
  }

  protected override onPropsChanged(): void {
    this.props = MiniMap.normalizeProps(this.props)
    this.options({ interactive: this.props.visible })
  }

  private setupEvents(): void {
    this.on('mousedown', event => {
      if (!this.props.draggableViewport || event.button !== 0) return false
      this.dragging = true
      this.panTo({ x: event.offsetX, y: event.offsetY })
      return false
    })
    this.on('mousemove', event => {
      if (!this.dragging) return false
      this.panTo({ x: event.offsetX, y: event.offsetY })
      return false
    })
    this.on('mouseup', () => {
      this.dragging = false
      return false
    })
    this.on('mouseleave', () => {
      this.dragging = false
    })
  }

  private panTo(point: ModelerPoint): void {
    const context = this.inject(MODELER_CONTEXT)
    if (!context) return
    const mini = this.resolveLayout()
    const layout = context.getLayout()
    const nx = clamp01((point.x - mini.content.x) / Math.max(1, mini.content.width))
    const ny = clamp01((point.y - mini.content.y) / Math.max(1, mini.content.height))
    const worldX = layout.worldBounds.x + layout.worldBounds.width * nx
    const worldY = layout.worldBounds.y + layout.worldBounds.height * ny
    const viewport = context.getViewport()
    context.setViewport({
      x: layout.width / 2 - worldX * viewport.scale,
      y: layout.height / 2 - worldY * viewport.scale,
      scale: viewport.scale,
    })
  }

  private resolveLayout(): MiniMapLayout {
    const context = this.inject(MODELER_CONTEXT)
    const store = this.injectOptional(MODELER_STORE)
    const layout = context?.getLayout() ?? {
      width: this.surface.width,
      height: this.surface.height,
      canvas: { x: 0, y: 0, width: this.surface.width, height: this.surface.height },
      viewport: { x: 0, y: 0, scale: 1 },
      worldBounds: { x: 0, y: 0, width: this.surface.width, height: this.surface.height },
    }
    if (store) {
      layout.viewport = store.viewport.toJSON()
      layout.worldBounds = store.canvas.toJSON()
    }
    const rect = this.resolveMiniMapRect()
    return createMiniMapLayout(layout, rect.width, rect.height, 0, 'top-left', rect)
  }

  private resolveMiniMapRect(): ModelerRect {
    const inset = this.props.inset
    if ((this.props.position === 'fixed' || this.props.position === 'absolute') && inset) {
      const x = typeof inset.left === 'number'
        ? inset.left
        : this.surface.width - this.props.width - (inset.right ?? this.props.margin)
      const y = typeof inset.top === 'number'
        ? inset.top
        : this.surface.height - this.props.height - (inset.bottom ?? this.props.margin)
      return { x, y, width: this.props.width, height: this.props.height }
    }
    const x = this.props.placement.includes('right')
      ? this.surface.width - this.props.width - this.props.margin
      : this.props.margin
    const y = this.props.placement.includes('bottom')
      ? this.surface.height - this.props.height - this.props.margin
      : this.props.margin
    return { x, y, width: this.props.width, height: this.props.height }
  }

  private resolveTheme(): MiniMapTheme {
    return {
      background: this.resolveColor('miniMapBackground'),
      borderColor: this.resolveColor('miniMapBorderColor'),
      contentBackground: this.resolveColor('miniMapContentBackground'),
      viewportBackground: this.resolveColor('miniMapViewportBackground'),
      viewportBorderColor: this.resolveColor('miniMapViewportBorderColor'),
    }
  }

  private resolveColor(token: keyof typeof MODELER_THEME_FALLBACKS): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export const MODELER_MINI_MAP_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  MiniMapResolvedProps,
  Record<string, never>,
  Record<string, never>,
  MiniMapProps
>(MiniMap as never) as MiniMapDescriptor
