import type { EventList } from '@endge/utils'
import { NovaComponent, NovaComponentNode, NovaTemplateRuntime, Prop, createNovaDecoratedComponentDescriptor, type NovaApp, type NovaComponentDescriptor, type NovaSurface } from '@endge/nova'
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
import type { ModelerController } from '@/domain/types/index'
import { clamp } from '@/tools/number'

export interface ZoomControlsProps extends Omit<UIKitZoomControlsProps, 'value' | 'onChange'> {
  controller?: ModelerController
}

export interface ModelerZoomControlsResolvedProps extends ZoomControlsResolvedProps {
  controller?: ModelerController
}

export type ZoomControlsDescriptor = NovaComponentDescriptor<
  ModelerZoomControlsResolvedProps,
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
  extends NovaComponentNode<ModelerZoomControlsResolvedProps, ZoomControlsApi, Record<string, never>, ZoomControlsProps, E> {
  readonly [NOVA_UI_LAYOUT_TARGET] = true as const

  private readonly childRuntime: NovaTemplateRuntime<E>
  private externalLayout = false

  @Prop.number({ default: 0.2 })
  declare step: number

  @Prop.object<ModelerController>()
  declare controller?: ModelerController

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ZoomControlsDescriptor,
    props: ModelerZoomControlsResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.childRuntime = new NovaTemplateRuntime(this)
    this.options({ width: props.width, height: props.height, interactive: false })
  }

  static normalizeProps(props: ZoomControlsProps = {}): ModelerZoomControlsResolvedProps {
    return {
      ...normalizeZoomControlsProps(props),
      controller: props.controller,
    }
  }

  override getApi(): ZoomControlsApi {
    return {
      zoomIn: () => this.zoomBy(1),
      zoomOut: () => this.zoomBy(-1),
      setValue: value => this.resolveViewportController()?.setViewport({ scale: value }),
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

  update(): void {
    super.update()
    this.syncChild()
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
    this.syncChild()
  }

  protected override onUnmount(): void {
    this.childRuntime.dispose()
    super.onUnmount()
  }

  private syncChild(): void {
    const viewportController = this.resolveViewportController()
    const store = this.injectOptional(MODELER_STORE)
    this.childRuntime.reconcile([{
      type: NovaUIKit.ZoomControls,
      id: `${this.componentId}:zoom`,
      props: {
        ...this.props,
        x: 0,
        y: 0,
        width: this.width,
        height: this.height,
        position: 'static',
        value: store?.viewport.scale ?? viewportController?.getViewport().scale ?? 1,
        onChange: (value: number) => viewportController?.setViewport({ scale: value }),
      },
    }])
  }

  private zoomBy(direction: -1 | 1): void {
    const viewportController = this.resolveViewportController()
    if (!viewportController) return
    const viewport = viewportController.getViewport()
    viewportController.setViewport({
      scale: clamp(viewport.scale + this.props.step * direction, this.props.minZoom, this.props.maxZoom),
    })
  }

  private resolveViewportController(): Pick<ModelerController, 'getViewport' | 'setViewport'> | undefined {
    return this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
  }
}

export const MODELER_ZOOM_CONTROLS_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ModelerZoomControlsResolvedProps,
  ZoomControlsApi,
  Record<string, never>,
  ZoomControlsProps
>(ZoomControls as never) as ZoomControlsDescriptor
