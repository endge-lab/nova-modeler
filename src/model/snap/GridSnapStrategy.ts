import type {
  ModelerPoint,
  ModelerRect,
  ModelerSnapPointInput,
  ModelerSnapResizeInput,
  ModelerSnapStrategy,
} from '@/domain/types/index'

/**
 * Привязывает координаты элемента к world-grid.
 */
export class GridSnapStrategy implements ModelerSnapStrategy {
  /**
   * Привязывает точку к ближайшей grid-точке.
   */
  snapPoint(input: ModelerSnapPointInput): ModelerPoint {
    const step = this.resolveStep(input.gridSize)
    return {
      x: this.snapValue(input.point.x, step),
      y: this.snapValue(input.point.y, step),
    }
  }

  /**
   * Привязывает resize bounds к grid с учетом активной стороны.
   */
  snapResize(input: ModelerSnapResizeInput): ModelerRect {
    const step = this.resolveStep(input.gridSize)
    const fixedRight = input.source.x + input.source.width
    const fixedBottom = input.source.y + input.source.height
    const rawRight = input.bounds.x + input.bounds.width
    const rawBottom = input.bounds.y + input.bounds.height
    let x = input.bounds.x
    let y = input.bounds.y
    let width = input.bounds.width
    let height = input.bounds.height

    if (input.handle.includes('w')) {
      x = Math.min(
        fixedRight - input.minSize.minWidth,
        this.snapValue(input.bounds.x, step),
      )
      width = fixedRight - x
    } else if (input.handle.includes('e')) {
      width = Math.max(
        input.minSize.minWidth,
        this.snapValue(rawRight, step) - input.source.x,
      )
      x = input.source.x
    }

    if (input.handle.includes('n')) {
      y = Math.min(
        fixedBottom - input.minSize.minHeight,
        this.snapValue(input.bounds.y, step),
      )
      height = fixedBottom - y
    } else if (input.handle.includes('s')) {
      height = Math.max(
        input.minSize.minHeight,
        this.snapValue(rawBottom, step) - input.source.y,
      )
      y = input.source.y
    }

    return {
      x,
      y,
      width: Math.max(input.minSize.minWidth, width),
      height: Math.max(input.minSize.minHeight, height),
    }
  }

  /**
   * Возвращает безопасный шаг grid.
   */
  private resolveStep(gridSize: number): number {
    return Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 1
  }

  /**
   * Округляет значение до ближайшего шага grid.
   */
  private snapValue(value: number, step: number): number {
    return Math.round(value / step) * step
  }
}
