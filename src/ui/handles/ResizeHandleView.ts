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
  ModelerResizeHandleDescriptor,
  ModelerViewport,
} from '@/domain/types/index'

export interface ResizeHandleViewProps {
  handle: ModelerResizeHandleDescriptor
  viewport: ModelerViewport
}

export interface ResizeHandleViewResolvedProps {
  handle: ModelerResizeHandleDescriptor
  viewport: ModelerViewport
}

export type ResizeHandleViewDescriptor = NovaComponentDescriptor<
  ResizeHandleViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  ResizeHandleViewProps
>

@NovaComponent({
  type: Modeler.ResizeHandleView,
  name: 'ResizeHandleView',
  version: '0.23.0',
  dirtyPolicy: {
    render: ['handle', 'viewport'],
  },
})
export class ResizeHandleView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ResizeHandleViewResolvedProps, Record<string, never>, Record<string, never>, ResizeHandleViewProps, E> {
  @Prop.object<ModelerResizeHandleDescriptor>({ required: true })
  declare handle: ModelerResizeHandleDescriptor

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ResizeHandleViewDescriptor,
    props: ResizeHandleViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: ResizeHandleViewProps): ResizeHandleViewResolvedProps {
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
        background: '#ffffff',
        border: { color: '#2563eb', width: 1, radius: 2 },
      },
    }] as NovaSchema)
  }
}

export const MODELER_RESIZE_HANDLE_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ResizeHandleViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  ResizeHandleViewProps
>(ResizeHandleView as never) as ResizeHandleViewDescriptor
