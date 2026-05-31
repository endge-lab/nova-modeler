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
  ModelerEdgeSegmentHandleDescriptor,
  ModelerEdgeWaypointHandleDescriptor,
  ModelerViewport,
} from '@/domain/types/index'

type EdgeHandleDescriptor = ModelerEdgeWaypointHandleDescriptor | ModelerEdgeSegmentHandleDescriptor

export interface EdgeWaypointHandleViewProps {
  handle: EdgeHandleDescriptor
  viewport: ModelerViewport
}

export interface EdgeWaypointHandleViewResolvedProps {
  handle: EdgeHandleDescriptor
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
  @Prop.object<EdgeHandleDescriptor>({ required: true })
  declare handle: EdgeHandleDescriptor

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
      type: 'circle',
      x: screen.x,
      y: screen.y,
      radius: size / 2,
      styles: {
        background: this.resolveThemeColor('elementHandleStroke'),
        opacity: 1,
        border: {
          color: this.resolveThemeColor('elementHandleFill'),
          width: Math.max(1, this.resolveThemeNumber('elementHandleStrokeWidth')),
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
