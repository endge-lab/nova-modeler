import type {
  ModelerElement,
  ModelerPoint,
  ModelerPluginContext,
  ModelerResizeHandle,
} from '@/domain/types/index'
import { SnapRuntime } from '@/model/snap/SnapRuntime'
import { eventPoint } from '@/tools/event-point'
import type { ElementsRuntime } from '@/plugins/elements/model/ElementsRuntime'

export class ElementsGestures {
  private activeResize: {
    element: ModelerElement
    handle: ModelerResizeHandle
    startWorld: ModelerPoint
  } | null = null

  private activeMove: {
    element: ModelerElement
    startWorld: ModelerPoint
  } | null = null

  private activeRotate: {
    element: ModelerElement
    center: ModelerPoint
    startAngle: number
    startRotation: number
    snapDegrees?: number
  } | null = null

  private readonly snap: SnapRuntime

  constructor(
    private readonly context: ModelerPluginContext,
    private readonly runtime: ElementsRuntime,
  ) {
    this.snap = new SnapRuntime(context)
  }

  bind(addDisposer: (dispose: () => void) => void): void {
    addDisposer(this.context.gestures.add({
      id: 'modeler-elements:select',
      priority: 40,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'element',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'element') return false
        context.applyCommand({ type: 'select', ids: [target.id] })
        return false
      },
    }))
    addDisposer(this.context.gestures.add({
      id: 'modeler-elements:move',
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
          element: { ...element, data: { ...element.data }, style: { ...element.style } },
          startWorld: context.screenToWorld(eventPoint(event)),
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this.activeMove) return false
        const current = context.screenToWorld(eventPoint(event))
        const snapped = this.snap.moveElement({
          element: this.activeMove.element,
          raw: {
            x: this.activeMove.element.x + current.x - this.activeMove.startWorld.x,
            y: this.activeMove.element.y + current.y - this.activeMove.startWorld.y,
          },
          event,
        })
        context.applyCommand({
          type: 'element.patch',
          id: this.activeMove.element.id,
          patch: snapped,
        })
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
    addDisposer(this.context.gestures.add({
      id: 'modeler-elements:resize',
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
        const minSize = this.runtime.bounds.getMinSize(definition)
        const delta = this.runtime.geometry.rotateDelta(
          {
            x: current.x - this.activeResize.startWorld.x,
            y: current.y - this.activeResize.startWorld.y,
          },
          -(this.activeResize.element.rotation ?? 0),
        )
        const rawBounds = this.runtime.bounds.resizeBounds({
          element: this.activeResize.element,
          handle: this.activeResize.handle,
          dx: delta.x,
          dy: delta.y,
          minSize,
        })
        context.applyCommand({
          type: 'element.resize',
          id: this.activeResize.element.id,
          bounds: this.snap.resizeElement({
            element: this.activeResize.element,
            handle: this.activeResize.handle,
            rawBounds,
            minSize,
            event,
          }),
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
    addDisposer(this.context.gestures.add({
      id: 'modeler-elements:rotate',
      priority: 110,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'rotate-handle',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'rotate-handle') return false
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        const rotatable = definition?.capabilities?.rotatable
        if (!element || !rotatable) return false
        const center = this.runtime.geometry.elementCenter(element)
        const pointer = context.screenToWorld(eventPoint(event))
        this.activeRotate = {
          element: { ...element, data: { ...element.data }, style: { ...element.style } },
          center,
          startAngle: this.runtime.geometry.angleBetween(center, pointer),
          startRotation: element.rotation ?? 0,
          snapDegrees: rotatable.snapDegrees,
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this.activeRotate) return false
        const pointer = context.screenToWorld(eventPoint(event))
        const rotation = this.activeRotate.startRotation
          + this.runtime.geometry.angleBetween(this.activeRotate.center, pointer)
          - this.activeRotate.startAngle
        context.applyCommand({
          type: 'element.rotate',
          id: this.activeRotate.element.id,
          rotation: event.shiftKey
            ? this.runtime.geometry.snapRadians(rotation, this.activeRotate.snapDegrees)
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

  dispose(): void {
    this.activeResize = null
    this.activeMove = null
    this.activeRotate = null
  }
}
