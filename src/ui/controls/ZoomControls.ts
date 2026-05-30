import type { EventList } from '@endge/utils'
import { NovaComponent, NovaComponentNode, Prop, createNovaDecoratedComponentDescriptor, type NovaApp, type NovaComponentDescriptor, type NovaSurface } from '@endge/nova'
import {
  NOVA_UI_LAYOUT_TARGET,
  NovaUIKit,
  type NovaUiLayoutConstraints,
  type NovaUiLayoutMeasure,
  type NovaUiLayoutRect,
  normalizeZoomControlsProps,
  type ZoomControlsApi,
  type ZoomControlsProps as UIKitZoomControlsProps,
  type ZoomControlsResolvedProps,
} from '@endge/nova-ui-kit'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_CONTEXT,
  MODELER_STORE,
} from '@/config/context.config'
import { clamp } from '@/tools/number'

export interface ZoomControlsProps extends Omit<UIKitZoomControlsProps, 'value' | 'onChange'> {}

export type ZoomControlsDescriptor = NovaComponentDescriptor<
  ZoomControlsResolvedProps,
  ZoomControlsApi,
  Record<string, never>,
  ZoomControlsProps
>

@NovaComponent({
  type: Modeler.ZoomControls,
  name: 'ZoomControls',
  version: '0.22.0',
  dirtyPolicy: {
    render: ['step', 'minZoom', 'maxZoom', 'position', 'inset', 'visible'],
  },
})
export class ZoomControls<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ZoomControlsResolvedProps, ZoomControlsApi, Record<string, never>, ZoomControlsProps, E> {
  readonly [NOVA_UI_LAYOUT_TARGET] = true as const

  private childId = `${this.id}:zoom`
  private externalLayout = false

  @Prop.number({ default: 0.2 })
  declare step: number

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ZoomControlsDescriptor,
    props: ZoomControlsResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: props.width, height: props.height, interactive: false })
  }

  static normalizeProps(props: ZoomControlsProps = {}): ZoomControlsResolvedProps {
    return normalizeZoomControlsProps(props)
  }

  override getApi(): ZoomControlsApi {
    return {
      zoomIn: () => this.zoomBy(1),
      zoomOut: () => this.zoomBy(-1),
      setValue: value => this.inject(MODELER_CONTEXT)?.setViewport({ scale: value }),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: ZoomControlsProps): this {
    super.setProps(patch as Partial<ZoomControlsResolvedProps>)
    if (!this.externalLayout) {
      this.options({ width: this.props.width, height: this.props.height, interactive: false })
    }
    return this
  }

  applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    this.externalLayout = true
    const sizeChanged = this.width !== rect.width || this.height !== rect.height
    const changed = this.x !== rect.x
      || this.y !== rect.y
      || sizeChanged
    this.options({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      interactive: false,
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
    const context = this.inject(MODELER_CONTEXT)
    const store = this.injectOptional(MODELER_STORE)
    this.renderer.schema([{
      type: NovaUIKit.ZoomControls,
      id: this.childId,
      props: {
        ...this.props,
        value: store?.viewport.scale ?? context?.getViewport().scale ?? 1,
        onChange: (value: number) => context?.setViewport({ scale: value }),
      },
    }])
  }

  private zoomBy(direction: -1 | 1): void {
    const context = this.inject(MODELER_CONTEXT)
    if (!context) return
    const viewport = context.getViewport()
    context.setViewport({
      scale: clamp(viewport.scale + this.props.step * direction, this.props.minZoom, this.props.maxZoom),
    })
  }
}

export const MODELER_ZOOM_CONTROLS_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ZoomControlsResolvedProps,
  ZoomControlsApi,
  Record<string, never>,
  ZoomControlsProps
>(ZoomControls as never) as ZoomControlsDescriptor
