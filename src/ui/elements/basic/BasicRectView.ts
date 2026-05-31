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
    const borderColor = this.props.selected
      ? String(style.selectedStroke ?? this.resolveThemeColor('basicRectSelectedStroke', 'elementSelectedStroke'))
      : String(style.stroke ?? this.resolveThemeColor('basicRectStroke', 'elementStroke'))
    this.renderer.schema([{
      type: 'rect',
      x: -this.width / 2,
      y: -this.height / 2,
      width: this.width,
      height: this.height,
      styles: {
        background: String(style.fill ?? this.resolveThemeColor('basicRectFill', 'elementFill')),
        border: {
          color: borderColor,
          width: Number(style.strokeWidth ?? this.resolveThemeNumber('basicRectStrokeWidth', 'elementStrokeWidth')),
          radius: Number(style.radius ?? this.resolveThemeNumber('basicRectRadius')),
        },
        opacity: Number(style.opacity ?? this.resolveThemeNumber('elementOpacity')),
      },
    }] as NovaSchema)
  }

  private resolveThemeColor(token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): string {
    const fallback = fallbackToken
      ? String(this.resolveThemeValue(fallbackToken))
      : String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }

  private resolveThemeNumber(token: ModelerThemeTokenKey, fallbackToken?: ModelerThemeTokenKey): number {
    const fallback = fallbackToken
      ? this.resolveThemeNumber(fallbackToken)
      : Number(MODELER_THEME_FALLBACKS[token])
    const raw = this.nova.theme.resolve(MODELER_THEME_TOKENS[token], String(fallback)) ?? fallback
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }

  private resolveThemeValue(token: ModelerThemeTokenKey): string | number {
    const fallback = MODELER_THEME_FALLBACKS[token]
    return this.nova.theme.resolve(
      MODELER_THEME_TOKENS[token],
      String(fallback),
    ) ?? fallback
  }
}

export const MODELER_BASIC_RECT_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BasicRectViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BasicRectViewProps
>(BasicRectView as never) as BasicRectViewDescriptor
