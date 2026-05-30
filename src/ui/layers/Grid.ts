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
  MODELER_CONTEXT,
  MODELER_STORE,
} from '@/config/context.config'
import { MODELER_GRID_RENDER_CONFIG } from '@/config/grid.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
} from '@/config/theme.config'
import type {
  ModelerGridRenderPlan as GridRenderPlan,
  ModelerGridRenderPlanInput as GridRenderPlanInput,
  ModelerGridProps as GridProps,
  ModelerGridResolvedProps as GridResolvedProps,
} from '@/domain/types/index'
import { clamp } from '@/tools/number'

export type GridDescriptor = NovaComponentDescriptor<
  GridResolvedProps,
  Record<string, never>,
  Record<string, never>,
  GridProps
>

@NovaComponent({
  type: Modeler.Grid,
  name: 'Grid',
  version: '0.22.0',
  dirtyPolicy: {
    render: ['visible', 'variant', 'gridSize', 'color'],
  },
})
export class Grid<E extends EventList = Record<string, any>>
  extends NovaComponentNode<GridResolvedProps, Record<string, never>, Record<string, never>, GridProps, E> {
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: GridDescriptor,
    props: GridResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({ width: surface.width, height: surface.height, interactive: false })
    this.addDisposer(app.theme.observe(this, { phase: 'render' }))
  }

  static normalizeProps(props: GridProps = {}): GridResolvedProps {
    return {
      visible: props.visible ?? true,
      variant: 'dots',
      gridSize: Grid.finiteOptionalNumber(props.gridSize),
      color: props.color,
    }
  }

  update(): void {
    super.update()
    this.options({ width: this.surface.width, height: this.surface.height, interactive: false })
  }

  render(): void {
    super.render()
    const context = this.inject(MODELER_CONTEXT)
    const store = this.injectOptional(MODELER_STORE)
    if (!this.props.visible || !context) {
      this.renderer.schema([] as unknown as NovaSchema)
      return
    }

    const layout = context.getLayout()
    const gridSize = this.props.gridSize
      ?? store?.canvas.gridSize
      ?? context.getOptions().interaction?.gridSize
      ?? context.getModel().canvas.gridSize
    const viewport = store?.viewport.toJSON() ?? context.getModel().viewport
    const plan = Grid.createRenderPlan({
      width: layout.width,
      height: layout.height,
      gridSize,
      scale: viewport.scale,
      viewportX: viewport.x,
      viewportY: viewport.y,
    })
    const schema = [] as unknown as NovaSchema
    Grid.appendSchema(schema, plan, this.resolveDotColor())
    this.renderer.schema(schema)
  }

  static createRenderPlan(input: GridRenderPlanInput): GridRenderPlan {
    const minScreenSpacing = input.minScreenSpacing ?? MODELER_GRID_RENDER_CONFIG.minScreenSpacing
    const maxDots = input.maxDots ?? MODELER_GRID_RENDER_CONFIG.maxDots
    let spacing = Math.max(1, input.gridSize * input.scale)
    while (spacing < minScreenSpacing) spacing *= 2
    let columns = Grid.countAxis(input.width, spacing)
    let rows = Grid.countAxis(input.height, spacing)
    while (columns * rows > maxDots) {
      spacing *= 2
      columns = Grid.countAxis(input.width, spacing)
      rows = Grid.countAxis(input.height, spacing)
    }
    return {
      width: input.width,
      height: input.height,
      spacing,
      offsetX: Grid.positiveModulo(input.viewportX, spacing),
      offsetY: Grid.positiveModulo(input.viewportY, spacing),
      radius: clamp(
        input.scale * MODELER_GRID_RENDER_CONFIG.dotRadiusScale,
        MODELER_GRID_RENDER_CONFIG.minDotRadius,
        MODELER_GRID_RENDER_CONFIG.maxDotRadius,
      ),
      columns,
      rows,
      dotCount: columns * rows,
    }
  }

  static appendSchema(schema: NovaSchema, plan: GridRenderPlan, color: string): void {
    for (let column = 0; column < plan.columns; column += 1) {
      const x = plan.offsetX + column * plan.spacing
      if (x > plan.width) continue
      for (let row = 0; row < plan.rows; row += 1) {
        const y = plan.offsetY + row * plan.spacing
        if (y > plan.height) continue
        schema.push({ type: 'circle', x, y, radius: plan.radius, styles: { background: color } })
      }
    }
  }

  private resolveDotColor(): string {
    return this.props.color ?? this.nova.theme.resolve(
      MODELER_THEME_TOKENS.canvasDotColor,
      MODELER_THEME_FALLBACKS.canvasDotColor,
    ) ?? MODELER_THEME_FALLBACKS.canvasDotColor
  }

  private static finiteOptionalNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  private static countAxis(size: number, spacing: number): number {
    return Math.max(1, Math.ceil(size / spacing) + 1)
  }

  private static positiveModulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor
  }
}

export function createGridRenderPlan(input: GridRenderPlanInput): GridRenderPlan {
  return Grid.createRenderPlan(input)
}

export function appendGridSchema(schema: NovaSchema, plan: GridRenderPlan, color: string): void {
  Grid.appendSchema(schema, plan, color)
}

export const MODELER_GRID_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  GridResolvedProps,
  Record<string, never>,
  Record<string, never>,
  GridProps
>(Grid as never) as GridDescriptor
