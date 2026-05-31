import type {
  ModelerElement,
  ModelerElementDefinition,
  ModelerRect,
  ModelerResizeHandle,
} from '@/domain/types'

/**
 * Считает bounds элементов при resize.
 */
export class ElementsBounds {
  /**
   * Возвращает минимальный размер элемента из definition.
   */
  getMinSize(definition: ModelerElementDefinition | undefined): { minWidth: number; minHeight: number } {
    const resize = definition?.capabilities?.resizable
    return resize
      ? { minWidth: resize.minWidth ?? 1, minHeight: resize.minHeight ?? 1 }
      : { minWidth: 1, minHeight: 1 }
  }

  /**
   * Возвращает новые bounds для resize по активному handle.
   */
  resizeBounds(input: {
    element: ModelerElement
    handle: ModelerResizeHandle
    dx: number
    dy: number
    minSize: { minWidth: number; minHeight: number }
  }): ModelerRect {
    let x = input.element.x
    let y = input.element.y
    let width = input.element.width
    let height = input.element.height
    if (input.handle.includes('e')) width = input.element.width + input.dx
    if (input.handle.includes('s')) height = input.element.height + input.dy
    if (input.handle.includes('w')) {
      width = input.element.width - input.dx
      x = input.element.x + input.dx
    }
    if (input.handle.includes('n')) {
      height = input.element.height - input.dy
      y = input.element.y + input.dy
    }
    if (width < input.minSize.minWidth) {
      if (input.handle.includes('w')) x -= input.minSize.minWidth - width
      width = input.minSize.minWidth
    }
    if (height < input.minSize.minHeight) {
      if (input.handle.includes('n')) y -= input.minSize.minHeight - height
      height = input.minSize.minHeight
    }
    return { x, y, width, height }
  }
}
