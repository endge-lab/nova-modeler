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
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
  type ModelerThemeTokenKey,
} from '@/config/theme.config'

const MODELER_BRAND_FONT_FAMILY = 'ui-rounded, "SF Pro Rounded", ui-sans-serif, system-ui, sans-serif'

export interface BrandLogoProps {
  x?: number
  y?: number
  width?: number
  height?: number
  title?: string
  subtitle?: string
  visible?: boolean
  zIndex?: number
}

export interface BrandLogoResolvedProps {
  x: number
  y: number
  width: number
  height: number
  title: string
  subtitle: string
  visible: boolean
  zIndex?: number
}

export type BrandLogoDescriptor = NovaComponentDescriptor<
  BrandLogoResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BrandLogoProps
>

@NovaComponent({
  type: Modeler.BrandLogo,
  name: 'BrandLogo',
  version: '0.1.0',
  dirtyPolicy: {
    matrix: ['x', 'y', 'zIndex'],
    update: ['width', 'height', 'visible'],
    render: ['title', 'subtitle', 'visible'],
  },
})
export class BrandLogo<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BrandLogoResolvedProps, Record<string, never>, Record<string, never>, BrandLogoProps, E> {
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BrandLogoDescriptor,
    props: BrandLogoResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({
      x: props.x,
      y: props.y,
      width: props.width,
      height: props.height,
      interactive: false,
      zIndex: props.zIndex,
    })
    this.addDisposer(app.theme.observe(this, { phase: 'render' }))
  }

  static normalizeProps(props: BrandLogoProps = {}): BrandLogoResolvedProps {
    return {
      x: finiteNumber(props.x, 16),
      y: finiteNumber(props.y, 12),
      width: Math.max(96, finiteNumber(props.width, 164)),
      height: Math.max(40, finiteNumber(props.height, 48)),
      title: props.title ?? 'Nova',
      subtitle: props.subtitle ?? 'Modeler',
      visible: props.visible ?? true,
      zIndex: props.zIndex,
    }
  }

  override setProps(patch: BrandLogoProps): this {
    super.setProps(patch as Partial<BrandLogoResolvedProps>)
    this.props = BrandLogo.normalizeProps(this.props)
    this.options({
      x: this.props.x,
      y: this.props.y,
      width: this.props.width,
      height: this.props.height,
      interactive: false,
      zIndex: this.props.zIndex,
    })
    return this
  }

  render(): void {
    super.render()
    this.renderer.schema(this.createSchema())
  }

  private createSchema(): NovaSchema {
    if (!this.props.visible) return []
    const markSize = Math.min(38, this.height - 8)
    const markY = (this.height - markSize) / 2
    const textX = markSize + 8
    return [
      {
        type: 'icon',
        icon: MODELER_ASSETS.icons.novaLogo,
        x: 0,
        y: markY,
        width: markSize,
        height: markSize,
        styles: { opacity: 1 },
      },
      {
        type: 'text',
        text: this.props.title,
        x: textX,
        y: 3,
        width: Math.max(1, this.width - textX),
        height: 22,
        styles: {
          color: this.resolveThemeColor('brandTitleText'),
          font: {
            family: MODELER_BRAND_FONT_FAMILY,
            size: 22,
            weight: '900',
          },
          lineHeight: 22,
          align: { horizontal: 'left', vertical: 'middle' },
          ellipsis: true,
        },
      },
      {
        type: 'text',
        text: this.props.subtitle,
        x: textX + 1,
        y: 29,
        width: Math.max(1, this.width - textX - 1),
        height: 12,
        styles: {
          color: this.resolveThemeColor('brandSubtitleText'),
          font: {
            family: MODELER_BRAND_FONT_FAMILY,
            size: 10,
            weight: '700',
          },
          lineHeight: 12,
          align: { horizontal: 'left', vertical: 'middle' },
          ellipsis: true,
        },
      },
    ]
  }

  private resolveThemeColor(token: ModelerThemeTokenKey): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const MODELER_BRAND_LOGO_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BrandLogoResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BrandLogoProps
>(BrandLogo as never) as BrandLogoDescriptor
