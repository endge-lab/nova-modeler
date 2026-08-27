import type { NovaApp, NovaComponentDescriptor, NovaSurface } from '@endge/nova'
import type { NovaUiLayoutConstraints, NovaUiLayoutMeasure, NovaUiLayoutRect, ZoomControlsProps as UIKitZoomControlsProps, ZoomControlsApi, ZoomControlsResolvedProps } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type { ModelerController } from '@/domain/types/index'
import { createNovaDecoratedComponentDescriptor, NovaComponent, NovaComponentNode, NovaTemplateRuntime, Prop } from '@endge/nova'
import {
  normalizeZoomControlsProps,
  NOVA_UI_LAYOUT_TARGET,
  NovaUIKit,

} from '@endge/nova-ui-kit'
import {
  MODELER_CONTEXT,
  MODELER_STORE,
} from '@/config/context.config'
import { Modeler } from '@/config/schema.config'
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

  private readonly _childRuntime: NovaTemplateRuntime<E>
  private _externalLayout = false

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
    this._childRuntime = new NovaTemplateRuntime(this)
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
      zoomIn: () => this._zoomBy(1),
      zoomOut: () => this._zoomBy(-1),
      setValue: value => this._setViewportScale(value),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: ZoomControlsProps): this {
    super.setProps(patch as Partial<ZoomControlsResolvedProps>)
    if (!this._externalLayout) {
      this.options({ width: this.props.width, height: this.props.height, interactive: false })
    }
    return this
  }

  update(): void {
    super.update()
    this._syncChild()
  }

  applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    this._externalLayout = true
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
    if (changed) {
      this.dirty({ matrix: true, update: sizeChanged, render: true })
    }
    return changed
  }

  measureLayout(_constraints: NovaUiLayoutConstraints): NovaUiLayoutMeasure {
    return { width: this.props.width, height: this.props.height }
  }

  render(): void {
    this._syncChild()
  }

  protected override onUnmount(): void {
    this._childRuntime.dispose()
    super.onUnmount()
  }

  private _syncChild(): void {
    const viewportController = this._resolveViewportController()
    const store = this.injectOptional(MODELER_STORE)
    this._childRuntime.reconcile([{
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
        onChange: (value: number) => this._setViewportScale(value),
      },
    }])
  }

  private _zoomBy(direction: -1 | 1): void {
    const viewportController = this._resolveViewportController()
    if (!viewportController) {
      return
    }
    const viewport = viewportController.getViewport()
    this._setViewportScale(clamp(viewport.scale + this.props.step * direction, this.props.minZoom, this.props.maxZoom))
  }

  private _setViewportScale(scale: number): void {
    const viewportController = this._resolveViewportController()
    if (!viewportController) {
      return
    }
    const layout = viewportController.getLayout()
    const anchor = {
      x: layout.canvas.x + layout.canvas.width / 2,
      y: layout.canvas.y + layout.canvas.height / 2,
    }
    const world = viewportController.screenToWorld(anchor)
    viewportController.setViewport({
      x: anchor.x - world.x * scale,
      y: anchor.y - world.y * scale,
      scale,
    })
  }

  private _resolveViewportController(): Pick<ModelerController, 'getLayout' | 'getViewport' | 'screenToWorld' | 'setViewport'> | undefined {
    return this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
  }
}

export const MODELER_ZOOM_CONTROLS_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ModelerZoomControlsResolvedProps,
  ZoomControlsApi,
  Record<string, never>,
  ZoomControlsProps
>(ZoomControls as never) as ZoomControlsDescriptor
