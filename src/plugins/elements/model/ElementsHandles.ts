import type {
  ModelerElement,
  ModelerElementDefinition,
  ModelerResizeHandle,
  ModelerResizeHandleDescriptor,
  ModelerRotateHandleDescriptor,
} from '@/domain/types/index'
import {
  MODELER_RESIZE_HANDLE_SIZE,
  MODELER_ROTATE_HANDLE_SIZE,
} from '@/plugins/elements/elements.constants'
import type { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'

/**
 * Создает runtime handles для элементов.
 */
export class ElementsHandles {
  constructor(private readonly geometry: ElementsGeometry) {}

  /**
   * Создает resize handles с учетом rotation элемента.
   */
  createResizeHandles(
    element: ModelerElement,
    definition: ModelerElementDefinition,
  ): Array<ModelerResizeHandleDescriptor> {
    const resize = definition.capabilities?.resizable
    if (!resize) return []
    return resize.handles.map(handle => ({
      elementId: element.id,
      handle,
      size: MODELER_RESIZE_HANDLE_SIZE,
      cursor: this.cursorForResizeHandle(handle),
      ...this.geometry.rotatePoint(element, this.resizeHandlePoint(element, handle)),
    }))
  }

  /**
   * Создает rotate handle, если элемент поддерживает rotation.
   */
  createRotateHandle(
    element: ModelerElement,
    definition: ModelerElementDefinition,
  ): ModelerRotateHandleDescriptor | null {
    const rotatable = definition.capabilities?.rotatable
    if (!rotatable) return null
    return {
      elementId: element.id,
      size: MODELER_ROTATE_HANDLE_SIZE,
      cursor: 'grab',
      ...this.geometry.rotatePoint(element, {
        x: element.x + element.width / 2,
        y: element.y - (rotatable.handleOffset ?? 28),
      }),
    }
  }

  /**
   * Возвращает локальную точку resize handle.
   */
  private resizeHandlePoint(element: ModelerElement, handle: ModelerResizeHandle): { x: number; y: number } {
    const centerX = element.x + element.width / 2
    const centerY = element.y + element.height / 2
    return {
      x: handle.includes('w') ? element.x : handle.includes('e') ? element.x + element.width : centerX,
      y: handle.includes('n') ? element.y : handle.includes('s') ? element.y + element.height : centerY,
    }
  }

  /**
   * Возвращает CSS cursor для resize handle.
   */
  private cursorForResizeHandle(handle: ModelerResizeHandle): string {
    if (handle === 'n' || handle === 's') return 'ns-resize'
    if (handle === 'e' || handle === 'w') return 'ew-resize'
    if (handle === 'ne' || handle === 'sw') return 'nesw-resize'
    return 'nwse-resize'
  }
}
