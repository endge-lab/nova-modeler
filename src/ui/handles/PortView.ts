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
import { Modeler } from '@/config/schema.config'
import type {
  ModelerPort,
  ModelerViewport,
} from '@/domain/types/index'

export interface PortViewProps {
  port: ModelerPort
  viewport: ModelerViewport
  radius?: number
}

export interface PortViewResolvedProps {
  port: ModelerPort
  viewport: ModelerViewport
  radius: number
}

export type PortViewDescriptor = NovaComponentDescriptor<
  PortViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  PortViewProps
>

@NovaComponent({
  type: Modeler.PortView,
  name: 'PortView',
  version: '0.23.0',
  dirtyPolicy: {
    render: ['port', 'viewport', 'radius'],
  },
})
export class PortView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<PortViewResolvedProps, Record<string, never>, Record<string, never>, PortViewProps, E> {
  @Prop.object<ModelerPort>({ required: true })
  declare port: ModelerPort

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  @Prop.number({ default: 5 })
  declare radius: number

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: PortViewDescriptor,
    props: PortViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: PortViewProps): PortViewResolvedProps {
    return {
      port: props.port,
      viewport: props.viewport,
      radius: props.radius ?? props.port.radius ?? 5,
    }
  }

  update(): void {
    super.update()
    this.options({ width: this.surface.width, height: this.surface.height, interactive: false })
  }

  render(): void {
    super.render()
    this.renderer.schema([{
      type: 'circle',
      x: this.props.port.x * this.props.viewport.scale + this.props.viewport.x,
      y: this.props.port.y * this.props.viewport.scale + this.props.viewport.y,
      radius: this.props.radius,
      styles: {
        background: '#ffffff',
        border: { color: '#2563eb', width: 2 },
      },
    }] as NovaSchema)
  }
}

export const MODELER_PORT_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  PortViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  PortViewProps
>(PortView as never) as PortViewDescriptor
