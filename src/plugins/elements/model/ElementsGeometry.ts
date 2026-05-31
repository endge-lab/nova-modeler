import type {
  ModelerElement,
  ModelerPoint,
} from '@/domain/types'

/**
 * Выполняет geometry-операции для graph elements.
 */
export class ElementsGeometry {
  /**
   * Возвращает центр элемента в world coordinates.
   */
  elementCenter(element: ModelerElement): ModelerPoint {
    return {
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
    }
  }

  /**
   * Поворачивает world-точку вокруг центра элемента.
   */
  rotatePoint(element: ModelerElement, point: ModelerPoint): ModelerPoint {
    const rotation = element.rotation ?? 0
    if (rotation === 0) return { x: point.x, y: point.y }
    const center = this.elementCenter(element)
    const dx = point.x - center.x
    const dy = point.y - center.y
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    }
  }

  /**
   * Возвращает world-точку в локальную ориентацию элемента.
   */
  unrotatePoint(element: ModelerElement, point: ModelerPoint): ModelerPoint {
    const rotation = element.rotation ?? 0
    if (rotation === 0) return { x: point.x, y: point.y }
    const center = this.elementCenter(element)
    const dx = point.x - center.x
    const dy = point.y - center.y
    const cos = Math.cos(-rotation)
    const sin = Math.sin(-rotation)
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    }
  }

  /**
   * Поворачивает delta-vector без учета центра.
   */
  rotateDelta(delta: ModelerPoint, rotation: number): ModelerPoint {
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    return {
      x: delta.x * cos - delta.y * sin,
      y: delta.x * sin + delta.y * cos,
    }
  }

  /**
   * Возвращает угол между центром и точкой.
   */
  angleBetween(center: ModelerPoint, point: ModelerPoint): number {
    return Math.atan2(point.y - center.y, point.x - center.x)
  }

  /**
   * Округляет угол до шага в градусах.
   */
  snapRadians(rotation: number, snapDegrees?: number): number {
    if (!snapDegrees || snapDegrees <= 0) return rotation
    const step = snapDegrees * Math.PI / 180
    return Math.round(rotation / step) * step
  }
}
