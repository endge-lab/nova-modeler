import type { NovaTemplateChildSchema } from '@endge/nova'
import { Modeler } from '@/config/schema.config'
import type {
  ModelerElement,
  ModelerElementDefinition,
  ModelerPoint,
  ModelerPort,
  ModelerRect,
  ModelerResizeHandle,
  ModelerResizeHandleDescriptor,
  ModelerRotateHandleDescriptor,
} from '@/domain/types/index'
import { PluginBase } from '@/model/plugin-runtime/PluginBase'
import { eventPoint } from '@/tools/event-point'

export const MODELER_ELEMENTS_PLUGIN_ID = 'modeler-elements'
export const MODELER_RESIZE_HANDLE_SIZE = 8
export const MODELER_ROTATE_HANDLE_SIZE = 10
export const MODELER_PORT_RADIUS = 5

/**
 * Рендерит graph elements и базовую resize-интеракцию.
 */
export class ElementsPlugin extends PluginBase {
  readonly id = MODELER_ELEMENTS_PLUGIN_ID
  private disposeLayer: (() => void) | undefined
  private activeResize: {
    element: ModelerElement
    handle: ModelerResizeHandle
    startWorld: { x: number; y: number }
  } | null = null
  private activeMove: {
    elementId: string
    lastWorld: ModelerPoint
  } | null = null
  private activeRotate: {
    element: ModelerElement
    center: ModelerPoint
    startAngle: number
    startRotation: number
    snapDegrees?: number
  } | null = null

  /**
   * Создает plugin для graph elements.
   */
  static create(): ElementsPlugin {
    return new ElementsPlugin()
  }

  /**
   * Подключает rendering, selection и resize gestures.
   */
  protected onSetup(): void {
    this.syncLayer()
    this.addDisposer(this.context.model.subscribe(() => this.syncLayer()))
    this.addDisposer(this.context.gestures.add({
      id: `${this.id}:select`,
      priority: 40,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'element',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'element') return false
        context.applyCommand({ type: 'select', ids: [target.id] })
        return false
      },
    }))
    this.addDisposer(this.context.gestures.add({
      id: `${this.id}:move`,
      priority: 90,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'element',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'element') return false
        const element = context.getModel().elements.find(item => item.id === target.id)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        if (!element || definition?.capabilities?.draggable === false) return false
        context.applyCommand({ type: 'select', ids: [target.id] })
        this.activeMove = {
          elementId: target.id,
          lastWorld: context.screenToWorld(eventPoint(event)),
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this.activeMove) return false
        const current = context.screenToWorld(eventPoint(event))
        context.applyCommand({
          type: 'element.move',
          id: this.activeMove.elementId,
          dx: current.x - this.activeMove.lastWorld.x,
          dy: current.y - this.activeMove.lastWorld.y,
        })
        this.activeMove = { ...this.activeMove, lastWorld: current }
        return false
      },
      onPointerUp: () => {
        this.activeMove = null
        return false
      },
      onCancel: () => {
        this.activeMove = null
      },
    }))
    this.addDisposer(this.context.gestures.add({
      id: `${this.id}:resize`,
      priority: 100,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'resize-handle',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'resize-handle') return false
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        if (!element) return false
        this.activeResize = {
          element: { ...element, data: { ...element.data }, style: { ...element.style } },
          handle: target.handle,
          startWorld: context.screenToWorld(eventPoint(event)),
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this.activeResize) return false
        const current = context.screenToWorld(eventPoint(event))
        const definition = context.getElementRegistry().get(this.activeResize.element.type)
        const minSize = getElementMinSize(definition)
        const delta = rotateDelta(
          {
            x: current.x - this.activeResize.startWorld.x,
            y: current.y - this.activeResize.startWorld.y,
          },
          -(this.activeResize.element.rotation ?? 0),
        )
        context.applyCommand({
          type: 'element.resize',
          id: this.activeResize.element.id,
          bounds: resizeBounds(
            this.activeResize.element,
            this.activeResize.handle,
            delta.x,
            delta.y,
            minSize,
          ),
        })
        return false
      },
      onPointerUp: () => {
        this.activeResize = null
        return false
      },
      onCancel: () => {
        this.activeResize = null
      },
    }))
    this.addDisposer(this.context.gestures.add({
      id: `${this.id}:rotate`,
      priority: 110,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'rotate-handle',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'rotate-handle') return false
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        const rotatable = definition?.capabilities?.rotatable
        if (!element || !rotatable) return false
        const center = elementCenter(element)
        const pointer = context.screenToWorld(eventPoint(event))
        this.activeRotate = {
          element: { ...element, data: { ...element.data }, style: { ...element.style } },
          center,
          startAngle: angleBetween(center, pointer),
          startRotation: element.rotation ?? 0,
          snapDegrees: rotatable.snapDegrees,
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this.activeRotate) return false
        const pointer = context.screenToWorld(eventPoint(event))
        const rotation = this.activeRotate.startRotation
          + angleBetween(this.activeRotate.center, pointer)
          - this.activeRotate.startAngle
        context.applyCommand({
          type: 'element.rotate',
          id: this.activeRotate.element.id,
          rotation: event.shiftKey
            ? snapRadians(rotation, this.activeRotate.snapDegrees)
            : rotation,
        })
        return false
      },
      onPointerUp: () => {
        this.activeRotate = null
        return false
      },
      onCancel: () => {
        this.activeRotate = null
      },
    }))
  }

  /**
   * Очищает mounted layer runtime.
   */
  protected override onDispose(): void {
    this.disposeLayer?.()
    this.disposeLayer = undefined
    this.activeResize = null
    this.activeMove = null
    this.activeRotate = null
  }

  /**
   * Синхронизирует element nodes в interaction layer.
   */
  private syncLayer(): void {
    const context = this.context
    const schemas: Array<NovaTemplateChildSchema> = []
    const model = context.getModel()
    const selected = new Set(model.selection)
    for (const element of model.elements) {
      const definition = context.getElementRegistry().get(element.type)
      if (!definition) continue
      schemas.push(definition.render({ ...context, selected: selected.has(element.id) }, element))
      if (!selected.has(element.id)) continue
      const rotateHandle = createRotateHandle(element, definition)
      if (rotateHandle) {
        schemas.push({
          type: Modeler.RotateHandleView,
          id: `${element.id}:rotate`,
          props: { handle: rotateHandle, viewport: context.getViewport() },
        })
      }
      for (const handle of createResizeHandles(element, definition)) {
        schemas.push({
          type: Modeler.ResizeHandleView,
          id: `${element.id}:resize:${handle.handle}`,
          props: { handle, viewport: context.getViewport() },
        })
      }
      for (const port of createElementPorts(element, definition.getPorts?.(context, element) ?? [])) {
        schemas.push({
          type: Modeler.PortView,
          id: `${element.id}:port:${port.id}`,
          props: { port, viewport: context.getViewport(), radius: MODELER_PORT_RADIUS },
        })
      }
    }
    this.disposeLayer = context.layers.reconcile('interaction', this.id, schemas)
    context.invalidate('render')
  }
}

export function createResizeHandles(
  element: ModelerElement,
  definition: ModelerElementDefinition,
): Array<ModelerResizeHandleDescriptor> {
  const resize = definition.capabilities?.resizable
  if (!resize) return []
  return resize.handles.map(handle => ({
    elementId: element.id,
    handle,
    size: MODELER_RESIZE_HANDLE_SIZE,
    cursor: cursorForResizeHandle(handle),
    ...rotateElementPoint(element, resizeHandlePoint(element, handle)),
  }))
}

export function createRotateHandle(
  element: ModelerElement,
  definition: ModelerElementDefinition,
): ModelerRotateHandleDescriptor | null {
  const rotatable = definition.capabilities?.rotatable
  if (!rotatable) return null
  return {
    elementId: element.id,
    size: MODELER_ROTATE_HANDLE_SIZE,
    cursor: 'grab',
    ...rotateElementPoint(element, {
      x: element.x + element.width / 2,
      y: element.y - (rotatable.handleOffset ?? 28),
    }),
  }
}

export function createElementPorts(element: ModelerElement, ports: Array<ModelerPort>): Array<ModelerPort> {
  return ports.map(port => ({
    ...port,
    ...rotateElementPoint(element, port),
  }))
}

export function resizeBounds(
  element: ModelerElement,
  handle: ModelerResizeHandle,
  dx: number,
  dy: number,
  minSize: { minWidth: number; minHeight: number },
): ModelerRect {
  let x = element.x
  let y = element.y
  let width = element.width
  let height = element.height
  if (handle.includes('e')) width = element.width + dx
  if (handle.includes('s')) height = element.height + dy
  if (handle.includes('w')) {
    width = element.width - dx
    x = element.x + dx
  }
  if (handle.includes('n')) {
    height = element.height - dy
    y = element.y + dy
  }
  if (width < minSize.minWidth) {
    if (handle.includes('w')) x -= minSize.minWidth - width
    width = minSize.minWidth
  }
  if (height < minSize.minHeight) {
    if (handle.includes('n')) y -= minSize.minHeight - height
    height = minSize.minHeight
  }
  return { x, y, width, height }
}

export function getElementMinSize(definition: ModelerElementDefinition | undefined): { minWidth: number; minHeight: number } {
  const resize = definition?.capabilities?.resizable
  return resize
    ? { minWidth: resize.minWidth ?? 1, minHeight: resize.minHeight ?? 1 }
    : { minWidth: 1, minHeight: 1 }
}

function resizeHandlePoint(element: ModelerElement, handle: ModelerResizeHandle): { x: number; y: number } {
  const centerX = element.x + element.width / 2
  const centerY = element.y + element.height / 2
  return {
    x: handle.includes('w') ? element.x : handle.includes('e') ? element.x + element.width : centerX,
    y: handle.includes('n') ? element.y : handle.includes('s') ? element.y + element.height : centerY,
  }
}

export function elementCenter(element: ModelerElement): ModelerPoint {
  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  }
}

export function rotateElementPoint(element: ModelerElement, point: ModelerPoint): ModelerPoint {
  const rotation = element.rotation ?? 0
  if (rotation === 0) return { x: point.x, y: point.y }
  const center = elementCenter(element)
  const dx = point.x - center.x
  const dy = point.y - center.y
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export function unrotateElementPoint(element: ModelerElement, point: ModelerPoint): ModelerPoint {
  const rotation = element.rotation ?? 0
  if (rotation === 0) return { x: point.x, y: point.y }
  const center = elementCenter(element)
  const dx = point.x - center.x
  const dy = point.y - center.y
  const cos = Math.cos(-rotation)
  const sin = Math.sin(-rotation)
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

function rotateDelta(delta: ModelerPoint, rotation: number): ModelerPoint {
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return {
    x: delta.x * cos - delta.y * sin,
    y: delta.x * sin + delta.y * cos,
  }
}

function angleBetween(center: ModelerPoint, point: ModelerPoint): number {
  return Math.atan2(point.y - center.y, point.x - center.x)
}

function snapRadians(rotation: number, snapDegrees?: number): number {
  if (!snapDegrees || snapDegrees <= 0) return rotation
  const step = snapDegrees * Math.PI / 180
  return Math.round(rotation / step) * step
}

function cursorForResizeHandle(handle: ModelerResizeHandle): string {
  if (handle === 'n' || handle === 's') return 'ns-resize'
  if (handle === 'e' || handle === 'w') return 'ew-resize'
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize'
  return 'nwse-resize'
}
