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
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
  type ModelerThemeTokenKey,
} from '@/config/theme.config'
import type {
  ModelerPort,
  ModelerViewport,
} from '@/domain/types/index'

export interface PortViewProps {
  port: ModelerPort
  viewport: ModelerViewport
  radius?: number
  highlighted?: boolean
}

export interface PortViewResolvedProps {
  port: ModelerPort
  viewport: ModelerViewport
  radius: number
  highlighted: boolean
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
    render: ['port', 'viewport', 'radius', 'highlighted'],
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
      highlighted: props.highlighted ?? false,
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
        background: this.props.highlighted
          ? this.resolveThemeColor('bpmnFlowMarkerFill')
          : this.resolveThemeColor('elementPortFill'),
        border: {
          color: this.props.highlighted
            ? this.resolveThemeColor('bpmnFlowPreviewStroke')
            : this.resolveThemeColor('elementPortStroke'),
          width: this.props.highlighted
            ? Math.max(2, this.resolveThemeNumber('elementPortStrokeWidth') + 1)
            : this.resolveThemeNumber('elementPortStrokeWidth'),
        },
      },
    }] as NovaSchema)
  }

  private resolveThemeColor(token: ModelerThemeTokenKey): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }

  private resolveThemeNumber(token: ModelerThemeTokenKey): number {
    const fallback = Number(MODELER_THEME_FALLBACKS[token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
}

export const MODELER_PORT_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  PortViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  PortViewProps
>(PortView as never) as PortViewDescriptor
