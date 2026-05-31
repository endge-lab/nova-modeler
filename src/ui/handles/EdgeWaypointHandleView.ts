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
  ModelerEdgeWaypointHandleDescriptor,
  ModelerViewport,
} from '@/domain/types/index'

export interface EdgeWaypointHandleViewProps {
  handle: ModelerEdgeWaypointHandleDescriptor
  viewport: ModelerViewport
}

export interface EdgeWaypointHandleViewResolvedProps {
  handle: ModelerEdgeWaypointHandleDescriptor
  viewport: ModelerViewport
}

export type EdgeWaypointHandleViewDescriptor = NovaComponentDescriptor<
  EdgeWaypointHandleViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  EdgeWaypointHandleViewProps
>

@NovaComponent({
  type: Modeler.EdgeWaypointHandleView,
  name: 'EdgeWaypointHandleView',
  version: '0.1.0',
  dirtyPolicy: {
    render: ['handle', 'viewport'],
  },
})
export class EdgeWaypointHandleView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<EdgeWaypointHandleViewResolvedProps, Record<string, never>, Record<string, never>, EdgeWaypointHandleViewProps, E> {
  @Prop.object<ModelerEdgeWaypointHandleDescriptor>({ required: true })
  declare handle: ModelerEdgeWaypointHandleDescriptor

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: EdgeWaypointHandleViewDescriptor,
    props: EdgeWaypointHandleViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: EdgeWaypointHandleViewProps): EdgeWaypointHandleViewResolvedProps {
    return {
      handle: props.handle,
      viewport: props.viewport,
    }
  }

  update(): void {
    super.update()
    this.options({ width: this.surface.width, height: this.surface.height, interactive: false })
  }

  render(): void {
    super.render()
    const screen = {
      x: this.props.handle.x * this.props.viewport.scale + this.props.viewport.x,
      y: this.props.handle.y * this.props.viewport.scale + this.props.viewport.y,
    }
    const size = this.props.handle.size
    this.renderer.schema([{
      type: 'rect',
      x: screen.x - size / 2,
      y: screen.y - size / 2,
      width: size,
      height: size,
      styles: {
        background: this.resolveThemeColor('elementHandleFill'),
        border: {
          color: this.resolveThemeColor('elementHandleStroke'),
          width: this.resolveThemeNumber('elementHandleStrokeWidth'),
          radius: this.resolveThemeNumber('elementHandleRadius'),
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

export const MODELER_EDGE_WAYPOINT_HANDLE_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  EdgeWaypointHandleViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  EdgeWaypointHandleViewProps
>(EdgeWaypointHandleView as never) as EdgeWaypointHandleViewDescriptor
