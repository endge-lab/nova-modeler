import type {
  ModelerPoint,
  ModelerRect,
  ModelerSnapPointInput,
  ModelerSnapResizeInput,
  ModelerSnapStrategy,
} from '@/domain/types/index'

/**
 * Возвращает исходные координаты без привязки.
 */
export class NoopSnapStrategy implements ModelerSnapStrategy {
  /**
   * Возвращает исходную точку.
   */
  snapPoint(input: ModelerSnapPointInput): ModelerPoint {
    return input.point
  }

  /**
   * Возвращает исходные bounds.
   */
  snapResize(input: ModelerSnapResizeInput): ModelerRect {
    return input.bounds
  }
}
