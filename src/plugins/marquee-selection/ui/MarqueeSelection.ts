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
import { MODELER_CONTEXT } from '@/config/context.config'
import type {
  ModelerPoint,
  ModelerRect,
} from '@/domain/types/index'
import { eventPoint } from '@/tools/event-point'
import { createMarqueeSchema } from '@/plugins/marquee-selection/marquee-selection-schema'

export interface MarqueeSelectionProps {
  enabled?: boolean
  minDragPx?: number
  onSelectionComplete?: (ids: Array<string>) => void
}

export interface MarqueeSelectionResolvedProps {
  enabled: boolean
  minDragPx: number
  onSelectionComplete?: (ids: Array<string>) => void
}

export type MarqueeSelectionDescriptor = NovaComponentDescriptor<
  MarqueeSelectionResolvedProps,
  Record<string, never>,
  Record<string, never>,
  MarqueeSelectionProps
>

@NovaComponent({
  type: Modeler.MarqueeSelection,
  name: 'MarqueeSelection',
  version: '0.22.0',
  dirtyPolicy: {
    update: ['enabled', 'minDragPx'],
    render: ['onSelectionComplete'],
  },
})
export class MarqueeSelection<E extends EventList = Record<string, any>>
  extends NovaComponentNode<MarqueeSelectionResolvedProps, Record<string, never>, Record<string, never>, MarqueeSelectionProps, E> {
  @Prop.boolean({ default: true })
  declare enabled: boolean

  private draft: { start: ModelerPoint; current: ModelerPoint } | null = null
  private disposeGesture: (() => void) | undefined

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: MarqueeSelectionDescriptor,
    props: MarqueeSelectionResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
  }

  static normalizeProps(props: MarqueeSelectionProps = {}): MarqueeSelectionResolvedProps {
    return {
      enabled: props.enabled ?? true,
      minDragPx: Math.max(0, Math.round(finiteNumber(props.minDragPx, 4))),
      onSelectionComplete: props.onSelectionComplete,
    }
  }

  protected override onMount(): void {
    super.onMount()
    this.registerGesture()
  }

  protected override onUnmount(): void {
    this.disposeGesture?.()
    this.disposeGesture = undefined
    this.draft = null
    super.onUnmount()
  }

  protected override onPropsChanged(): void {
    this.props = MarqueeSelection.normalizeProps(this.props)
  }

  update(): void {
    super.update()
    this.options({ width: this.surface.width, height: this.surface.height, interactive: false })
  }

  render(): void {
    super.render()
    this.renderer.schema(this.draft
      ? [createMarqueeSchema(resolveRect(this.draft.start, this.draft.current))] as NovaSchema
      : [] as unknown as NovaSchema)
  }

  private registerGesture(): void {
    const context = this.inject(MODELER_CONTEXT)
    if (!context) return
    this.disposeGesture = context.gestures.add({
      id: `${this.componentId}:gesture`,
      priority: 80,
      hitTest: (_ctx, event, target) => this.props.enabled && event.button === 0 && event.shiftKey && target.type === 'canvas',
      onPointerDown: (_ctx, event) => {
        const point = eventPoint(event)
        this.draft = { start: point, current: point }
        this.dirty({ render: true })
        return false
      },
      onPointerMove: (_ctx, event) => {
        if (!this.draft) return
        this.draft = { ...this.draft, current: eventPoint(event) }
        this.dirty({ render: true })
        return false
      },
      onPointerUp: ctx => {
        if (!this.draft) return
        const rect = resolveRect(this.draft.start, this.draft.current)
        this.draft = null
        const ids: Array<string> = rect.width >= this.props.minDragPx || rect.height >= this.props.minDragPx ? [] : []
        ctx.applyCommand({ type: 'select', ids })
        this.props.onSelectionComplete?.(ids)
        this.dirty({ render: true })
        return false
      },
      onCancel: () => {
        this.draft = null
        this.dirty({ render: true })
      },
    })
  }
}

function resolveRect(a: ModelerPoint, b: ModelerPoint): ModelerRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export const MODELER_MARQUEE_SELECTION_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  MarqueeSelectionResolvedProps,
  Record<string, never>,
  Record<string, never>,
  MarqueeSelectionProps
>(MarqueeSelection as never) as MarqueeSelectionDescriptor
