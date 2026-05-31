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
  ModelerRotateHandleDescriptor,
  ModelerViewport,
} from '@/domain/types/index'

export interface RotateHandleViewProps {
  handle: ModelerRotateHandleDescriptor
  viewport: ModelerViewport
}

export interface RotateHandleViewResolvedProps {
  handle: ModelerRotateHandleDescriptor
  viewport: ModelerViewport
}

export type RotateHandleViewDescriptor = NovaComponentDescriptor<
  RotateHandleViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  RotateHandleViewProps
>

@NovaComponent({
  type: Modeler.RotateHandleView,
  name: 'RotateHandleView',
  version: '0.23.0',
  dirtyPolicy: {
    render: ['handle', 'viewport'],
  },
})
export class RotateHandleView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<RotateHandleViewResolvedProps, Record<string, never>, Record<string, never>, RotateHandleViewProps, E> {
  @Prop.object<ModelerRotateHandleDescriptor>({ required: true })
  declare handle: ModelerRotateHandleDescriptor

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: RotateHandleViewDescriptor,
    props: RotateHandleViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: RotateHandleViewProps): RotateHandleViewResolvedProps {
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
    this.renderer.schema([{
      type: 'circle',
      x: screen.x,
      y: screen.y,
      radius: this.props.handle.size / 2,
      styles: {
        background: this.resolveThemeColor('elementHandleFill'),
        border: {
          color: this.resolveThemeColor('elementHandleStroke'),
          width: this.resolveThemeNumber('elementHandleStrokeWidth'),
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

export const MODELER_ROTATE_HANDLE_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  RotateHandleViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  RotateHandleViewProps
>(RotateHandleView as never) as RotateHandleViewDescriptor
