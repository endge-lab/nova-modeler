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
import type { ModelerExternalLabelLayout, ModelerViewport } from '@/domain/types/index'

export interface ExternalLabelViewProps {
  layout: ModelerExternalLabelLayout
  viewport?: ModelerViewport
  selected?: boolean
  hideText?: boolean
}

export interface ExternalLabelViewResolvedProps {
  layout: ModelerExternalLabelLayout
  viewport: ModelerViewport
  selected: boolean
  hideText: boolean
}

export type ExternalLabelViewDescriptor = NovaComponentDescriptor<
  ExternalLabelViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  ExternalLabelViewProps
>

const LABEL_HANDLE_SIZE = 8
const LABEL_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

@NovaComponent({
  type: Modeler.ExternalLabelView,
  name: 'ExternalLabelView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['viewport'],
    render: ['layout', 'selected', 'hideText'],
  },
})
export class ExternalLabelView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ExternalLabelViewResolvedProps, Record<string, never>, Record<string, never>, ExternalLabelViewProps, E> {
  @Prop.object<ModelerExternalLabelLayout>({ required: true })
  declare layout: ModelerExternalLabelLayout

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ExternalLabelViewDescriptor,
    props: ExternalLabelViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
    this.syncViewportTransform()
  }

  static normalizeProps(props: ExternalLabelViewProps): ExternalLabelViewResolvedProps {
    return {
      layout: props.layout,
      viewport: props.viewport ?? { x: 0, y: 0, scale: 1 },
      selected: props.selected ?? false,
      hideText: props.hideText ?? false,
    }
  }

  update(): void {
    super.update()
    this.syncViewportTransform()
  }

  override setProps(patch: Partial<ExternalLabelViewResolvedProps>): this {
    const changedKeys = (Object.keys(patch) as Array<keyof ExternalLabelViewResolvedProps>)
      .filter(key => patch[key] !== undefined && this.props[key] !== patch[key])
    if (changedKeys.length === 0) return this
    if (changedKeys.every(key => key === 'viewport')) {
      this.props.viewport = patch.viewport ?? this.props.viewport
      this.syncViewportTransform()
      this.notifySyncPortChanged('viewport', this.props.viewport)
      this.dirty({ matrix: true })
      return this
    }
    return super.setProps(patch)
  }

  render(): void {
    super.render()
    this.renderer.schema(this.createSchema())
  }

  private createSchema(): NovaSchema {
    const layout = this.props.layout
    const rect = layout.worldRect
    const schema: NovaSchema = []
    if (this.props.selected) {
      schema.push({
        type: 'line',
        x1: layout.worldConnectorStart.x,
        y1: layout.worldConnectorStart.y,
        x2: layout.worldConnectorEnd.x,
        y2: layout.worldConnectorEnd.y,
        styles: {
          color: '#7cc8ff',
          width: 3,
          dashPattern: [8, 8],
          opacity: 0.95,
        },
      })
      schema.push({
        type: 'rect',
        ...rect,
        styles: {
          background: 'rgba(255,255,255,0.78)',
          border: {
            color: '#c7c7c7',
            width: 1,
          },
        },
      })
    }
    if (layout.text && !this.props.hideText) {
      for (const line of layout.worldLines ?? layout.lines) {
        schema.push({
          type: 'text',
          text: line.text,
          x: line.x,
          y: line.y,
          width: line.widthLimit,
          height: line.height,
          clip: true,
          styles: {
            color: this.resolveThemeColor('bpmnTaskTextColor'),
            font: {
              family: layout.fontFamily,
              size: layout.worldFontSize ?? layout.fontSize,
              weight: layout.fontWeight,
            },
            lineHeight: layout.worldLineHeight ?? layout.lineHeight,
            align: { horizontal: 'center', vertical: 'top' },
            ellipsis: false,
          },
        })
      }
    }
    if (this.props.selected) this.appendHandles(schema, rect)
    return schema
  }

  private syncViewportTransform(): void {
    const scale = Math.max(0.0001, this.props.viewport.scale)
    this.options({
      x: this.props.viewport.x,
      y: this.props.viewport.y,
      width: Math.ceil(this.surface.width / scale),
      height: Math.ceil(this.surface.height / scale),
      scaleX: scale,
      scaleY: scale,
      interactive: false,
    })
  }

  private appendHandles(schema: NovaSchema, rect: { x: number; y: number; width: number; height: number }): void {
    for (const handle of LABEL_HANDLES) {
      const point = resolveHandlePoint(rect, handle)
      schema.push({
        type: 'rect',
        x: point.x - LABEL_HANDLE_SIZE / 2,
        y: point.y - LABEL_HANDLE_SIZE / 2,
        width: LABEL_HANDLE_SIZE,
        height: LABEL_HANDLE_SIZE,
        styles: {
          background: this.resolveThemeColor('elementHandleFill'),
          border: {
            color: this.resolveThemeColor('elementHandleStroke'),
            width: this.resolveThemeNumber('elementHandleStrokeWidth'),
            radius: this.resolveThemeNumber('elementHandleRadius'),
          },
        },
      })
    }
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

function resolveHandlePoint(rect: { x: number; y: number; width: number; height: number }, handle: typeof LABEL_HANDLES[number]): { x: number; y: number } {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  if (handle === 'n') return { x: cx, y: rect.y }
  if (handle === 'e') return { x: rect.x + rect.width, y: cy }
  if (handle === 's') return { x: cx, y: rect.y + rect.height }
  if (handle === 'w') return { x: rect.x, y: cy }
  return {
    x: handle.includes('e') ? rect.x + rect.width : rect.x,
    y: handle.includes('s') ? rect.y + rect.height : rect.y,
  }
}

export const MODELER_EXTERNAL_LABEL_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ExternalLabelViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  ExternalLabelViewProps
>(ExternalLabelView as never) as ExternalLabelViewDescriptor
