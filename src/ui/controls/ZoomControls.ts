import type { EventList } from '@endge/utils'
import { NovaComponent, NovaComponentNode, Prop, createNovaDecoratedComponentDescriptor, type NovaApp, type NovaComponentDescriptor, type NovaSurface } from '@endge/nova'
import {
  NovaUIKit,
  normalizeZoomControlsProps,
  type ZoomControlsApi,
  type ZoomControlsProps as UIKitZoomControlsProps,
  type ZoomControlsResolvedProps,
} from '@endge/nova-ui-kit'
import { Modeler } from '@/config/schema.config'
import { MODELER_CONTEXT } from '@/config/context.config'
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
  private childId = `${this.id}:zoom`

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

  render(): void {
    const context = this.inject(MODELER_CONTEXT)
    this.renderer.schema([{
      type: NovaUIKit.ZoomControls,
      id: this.childId,
      props: {
        ...this.props,
        value: context?.getViewport().scale ?? 1,
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
