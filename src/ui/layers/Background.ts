import {
  NovaComponent,
  NovaComponentNode,
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
} from '@/config/theme.config'
import type {
  ModelerBackgroundProps as BackgroundProps,
  ModelerBackgroundResolvedProps as BackgroundResolvedProps,
} from '@/domain/types/index'

export type BackgroundDescriptor = NovaComponentDescriptor<
  BackgroundResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BackgroundProps
>

@NovaComponent({
  type: Modeler.Background,
  name: 'Background',
  version: '0.22.0',
  dirtyPolicy: {
    render: ['visible', 'color'],
  },
})
export class Background<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BackgroundResolvedProps, Record<string, never>, Record<string, never>, BackgroundProps, E> {
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BackgroundDescriptor,
    props: BackgroundResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
    this.addDisposer(app.theme.observe(this, { phase: 'render' }))
  }

  static normalizeProps(props: BackgroundProps = {}): BackgroundResolvedProps {
    return {
      visible: props.visible ?? true,
      color: props.color,
    }
  }

  update(): void {
    super.update()
    this.options({ width: this.surface.width, height: this.surface.height, interactive: false })
  }

  render(): void {
    super.render()
    if (!this.props.visible) {
      this.renderer.schema([] as unknown as NovaSchema)
      return
    }
    this.renderer.schema([{
      type: 'rect',
      x: 0,
      y: 0,
      width: this.surface.width,
      height: this.surface.height,
      styles: {
        background: this.props.color ?? this.nova.theme.resolve(
          MODELER_THEME_TOKENS.canvasBackground,
          MODELER_THEME_FALLBACKS.canvasBackground,
        ) ?? MODELER_THEME_FALLBACKS.canvasBackground,
      },
    }] as NovaSchema)
  }
}

export const MODELER_BACKGROUND_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BackgroundResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BackgroundProps
>(Background as never) as BackgroundDescriptor
