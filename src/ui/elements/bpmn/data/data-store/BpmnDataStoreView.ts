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
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
  type ModelerThemeTokenKey,
} from '@/config/theme.config'
import type { ModelerViewport } from '@/domain/types'
import type { BpmnDataStoreElement } from '@/elements/bpmn/data/data-store/bpmn-data-store.types'
import {
  resolveBpmnTaskNameLayout,
  type BpmnTaskNameLayout,
} from '@/ui/elements/bpmn/task/BpmnTaskView'

export interface BpmnDataStoreViewProps {
  element: BpmnDataStoreElement
  viewport: ModelerViewport
  selected?: boolean
  hideName?: boolean
}

export interface BpmnDataStoreViewResolvedProps {
  element: BpmnDataStoreElement
  viewport: ModelerViewport
  selected: boolean
  hideName: boolean
}

export type BpmnDataStoreViewDescriptor = NovaComponentDescriptor<
  BpmnDataStoreViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnDataStoreViewProps
>

@NovaComponent({
  type: Modeler.BpmnDataStoreView,
  name: 'BpmnDataStoreView',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['element', 'viewport'],
    render: ['element', 'viewport', 'selected', 'hideName'],
  },
})
export class BpmnDataStoreView<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnDataStoreViewResolvedProps, Record<string, never>, Record<string, never>, BpmnDataStoreViewProps, E> {
  @Prop.object<BpmnDataStoreElement>({ required: true })
  declare element: BpmnDataStoreElement

  @Prop.object<ModelerViewport>({ required: true })
  declare viewport: ModelerViewport

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnDataStoreViewDescriptor,
    props: BpmnDataStoreViewResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: BpmnDataStoreViewProps): BpmnDataStoreViewResolvedProps {
    return {
      element: props.element,
      viewport: props.viewport,
      selected: props.selected ?? false,
      hideName: props.hideName ?? false,
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
    this.renderer.schema(this.createSchema())
  }

  private createSchema(): NovaSchema {
    const style = this.props.element.style ?? {}
    const stroke = this.props.selected
      ? String(style.selectedStroke ?? this.resolveThemeColor('elementSelectedStroke'))
      : String(style.stroke ?? this.resolveThemeColor('elementStroke'))
    const icon = resolveBpmnDataStoreIconLayout(this.width, this.height)
    const opacity = this.resolveStyleNumber(style.opacity, 'elementOpacity')
    const schema: NovaSchema = [{
      type: 'icon',
      icon: MODELER_ASSETS.icons.database,
      x: icon.x,
      y: icon.y,
      width: icon.width,
      height: icon.height,
      styles: {
        opacity,
      },
    }]
    if (this.props.selected) {
      schema.push({
        type: 'rect',
        x: icon.x - 4,
        y: icon.y - 4,
        width: icon.width + 8,
        height: icon.height + 8,
        styles: {
          background: 'rgba(0,0,0,0)',
          border: {
            color: stroke,
            width: 1,
            radius: 4,
          },
        },
      })
    }
    if (!this.props.hideName) this.appendLabel(schema)
    return schema
  }

  private appendLabel(schema: NovaSchema): void {
    const layout = resolveBpmnDataStoreNameLayout({
      name: this.props.element.data?.name ?? 'Data store',
      width: this.width,
      height: this.height,
    })
    const color = this.resolveThemeColor('bpmnTaskTextColor')
    for (const line of layout.lines) {
      schema.push({
        type: 'text',
        text: line.text,
        x: line.x,
        y: line.y,
        width: line.widthLimit,
        height: line.height,
        clip: true,
        styles: {
          color,
          font: {
            family: layout.fontFamily,
            size: layout.fontSize,
            weight: layout.fontWeight,
          },
          lineHeight: layout.lineHeight,
          align: { horizontal: 'center', vertical: 'top' },
          ellipsis: false,
        },
      })
    }
  }

  private resolveStyleNumber(value: unknown, token: ModelerThemeTokenKey): number {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : this.resolveThemeNumber(token)
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

export interface BpmnDataStoreIconLayout {
  x: number
  y: number
  width: number
  height: number
}

export function resolveBpmnDataStoreIconLayout(width: number, height: number): BpmnDataStoreIconLayout {
  const size = Math.max(1, Math.min(44, Math.min(width * 0.48, height * 0.4)))
  return {
    x: -size / 2,
    y: -height / 2 + Math.max(0, height * 0.04),
    width: size,
    height: size,
  }
}

export function resolveBpmnDataStoreNameLayout(input: {
  name?: string
  width: number
  height: number
}): BpmnTaskNameLayout {
  const icon = resolveBpmnDataStoreIconLayout(input.width, input.height)
  const labelTop = icon.y + icon.height + input.height * 0.06
  const labelHeight = Math.max(1, input.height / 2 - labelTop - input.height * 0.02)
  const horizontalInset = input.width * 0.067
  const labelRect = {
    x: -input.width / 2 + horizontalInset,
    y: labelTop,
    width: Math.max(1, input.width - horizontalInset * 2),
    height: labelHeight,
  }
  const virtualHeight = labelHeight + input.height * 0.29
  const virtualWidth = input.width + input.width * 0.067
  const layout = resolveBpmnTaskNameLayout({
    name: input.name ?? 'Data store',
    width: virtualWidth,
    height: virtualHeight,
    data: {
      taskType: 'none',
      loopType: 'none',
      isForCompensation: false,
    },
  })
  return {
    ...layout,
    rect: labelRect,
    lines: layout.lines.map((line, index) => ({
      ...line,
      x: labelRect.x,
      y: labelRect.y + index * layout.lineHeight,
      widthLimit: labelRect.width,
    })),
  }
}

export const MODELER_BPMN_DATA_STORE_VIEW_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnDataStoreViewResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnDataStoreViewProps
>(BpmnDataStoreView as never) as BpmnDataStoreViewDescriptor
