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
  ModelerElement,
  ModelerViewport,
} from '@/domain/types'

export interface BasicRectViewProps {
  element: ModelerElement
  viewport: ModelerViewport
  selected?: boolean
}

export interface BasicRectViewResolvedProps {
  element: ModelerElement
  viewport: ModelerViewport
  selected: boolean
}

export type BasicRectViewDescriptor = NovaComponentDescriptor<
  BasicRectViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BasicRectViewProps
>

@NovaComponent({
  type: Modeler.BasicRectView,
  name: 'BasicRectView',
  version: '0.23.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'selected'],
  },
})
export class BasicRectView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BasicRectViewResolvedProps, Record<string, never>, Record<string, never>, BasicRectViewProps, E> {
  @Prop.object<ModelerElement>({ required: true })
  declare element: ModelerElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BasicRectViewDescriptor,
    props: BasicRectViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BasicRectViewProps): BasicRectViewResolvedProps {
    return {
      element: props.element,
      viewport: props.viewport,
      selected: props.selected ?? false,
    }
  }

  update(): void {
    super.update()
    const element = this.props.element
    const viewport = this.props.viewport
    const scale = viewport.scale
    this.options({
      x: (element.x + element.width / 2) * scale + viewport.x,
      y: (element.y + element.height / 2) * scale + viewport.y,
      width: element.width * scale,
      height: element.height * scale,
      rotation: element.rotation ?? 0,
      interactive: false,
    })
  }

  render(): void {
    super.render()
    const element = this.props.element
    const style = element.style ?? {}
    this.renderer.schema([{
      type: 'rect',
      x: -this.width / 2,
      y: -this.height / 2,
      width: this.width,
      height: this.height,
      styles: {
        background: String(style.fill ?? '#ffffff'),
        border: {
          color: String(this.props.selected ? style.selectedStroke ?? '#2563eb' : style.stroke ?? '#94a3b8'),
          width: Number(style.strokeWidth ?? 1),
          radius: Number(style.radius ?? 0),
        },
      },
    }] as NovaSchema)
  }
}

export const MODELER_BASIC_RECT_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BasicRectViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BasicRectViewProps
>(BasicRectView as never) as BasicRectViewDescriptor
