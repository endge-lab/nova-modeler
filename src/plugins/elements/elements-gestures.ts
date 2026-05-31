import type {
  ModelerElement,
  ModelerEdgeElement,
  ModelerHitTarget,
  ModelerPoint,
  ModelerPluginContext,
  ModelerResizeHandle,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { SnapRuntime } from '@/model/snap/SnapRuntime'
import { SelectionRuntime } from '@/model/selection/SelectionRuntime'
import { eventPoint } from '@/tools/event-point'
import type { ElementsRuntime } from '@/plugins/elements/model/ElementsRuntime'

export class ElementsGestures {
  private activeResize: {
    element: ModelerElement
    handle: ModelerResizeHandle
    startWorld: ModelerPoint
  } | null = null

  private activeMove: {
    primary: ModelerElement
    elements: Array<ModelerElement>
    startWorld: ModelerPoint
  } | null = null

  private activeRotate: {
    element: ModelerElement
    center: ModelerPoint
    startAngle: number
    startRotation: number
    snapDegrees?: number
  } | null = null

  private activeWaypoint: {
    element: ModelerEdgeElement
    waypointIndex: number
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
      id: 'modeler-elements:create-flow',
      priority: 120,
      hitTest: (context, event, target) => event.button === 0
        && (target.type === 'port' || (context.tools.getActiveId() === 'connect' && target.type === 'element')),
      onPointerDown: (context, event) => {
        const point = eventPoint(event)
        const target = context.hitTest(point)
        const world = context.screenToWorld(point)
        if (context.tools.getActiveId() === 'connect' && this.runtime.connection.get()) {
          this.completeConnection(context, target, world)
          return false
        }
        if (target.type === 'port') {
          this.runtime.connectionFlow.beginFromPort(
            context,
            target.elementId,
            target.portId,
            context.tools.getActiveId() === 'connect' ? 'tool' : 'port-drag',
          )
          return false
        }
        if (context.tools.getActiveId() === 'connect' && target.type === 'element') {
          this.runtime.connectionFlow.beginFromElement(context, target.id, 'tool', world)
          return false
        }
        return false
      },
      onPointerMove: (context, event) => {
        const point = eventPoint(event)
        if (!this.runtime.connection.get()) return false
        this.runtime.connectionFlow.updatePreviewToPoint(
          context,
          context.screenToWorld(point),
          context.hitTest(point),
        )
        return false
      },
      onPointerUp: (context, event) => {
        const state = this.runtime.connection.get()
        if (!state) return false
        const point = eventPoint(event)
        const completed = this.completeConnection(context, context.hitTest(point), context.screenToWorld(point))
        if (!completed && state.origin === 'port-drag') this.runtime.connectionFlow.clear()
        return false
      },
      onCancel: () => {
        this.runtime.connectionFlow.clear()
      },
    }))
    addDisposer(this.context.gestures.add({
      id: 'modeler-elements:waypoint',
      priority: 115,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'edge-waypoint-handle',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'edge-waypoint-handle') return false
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        if (!element || !isModelerEdgeElement(element)) return false
        this.activeWaypoint = {
          element: {
            ...element,
            source: { ...element.source, point: element.source.point ? { ...element.source.point } : undefined },
            target: { ...element.target, point: element.target.point ? { ...element.target.point } : undefined },
            waypoints: element.waypoints.map(point => ({ ...point })),
            data: { ...element.data },
            style: { ...element.style },
          },
          waypointIndex: target.waypointIndex,
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this.activeWaypoint) return false
        const point = context.screenToWorld(eventPoint(event))
        const waypoints = this.activeWaypoint.element.waypoints.map((waypoint, index) => index === this.activeWaypoint?.waypointIndex
          ? { x: point.x, y: point.y }
          : { ...waypoint })
        context.applyCommand({
          type: 'element.patch',
          id: this.activeWaypoint.element.id,
          patch: { waypoints },
        })
        return false
      },
      onPointerUp: () => {
        this.activeWaypoint = null
        return false
      },
      onCancel: context => {
        if (this.activeWaypoint) {
          context.applyCommand({
            type: 'element.patch',
            id: this.activeWaypoint.element.id,
            patch: {
              waypoints: this.activeWaypoint.element.waypoints.map(point => ({ ...point })),
            },
          })
        }
        this.activeWaypoint = null
      },
    }))
    addDisposer(this.context.gestures.add({
      id: 'modeler-elements:select',
      priority: 40,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'element',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'element') return false
        context.applyCommand({
          type: 'select',
          ids: SelectionRuntime.resolvePointerSelection({
            current: context.getModel().selection,
            elementId: target.id,
            event,
            options: context.getOptions().interaction?.selection,
          }),
        })
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
        const model = context.getModel()
        const element = model.elements.find(item => item.id === target.id)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        if (!element || definition?.capabilities?.draggable === false) return false
        const nextSelection = this.shouldKeepCurrentSelection(model.selection, target.id, event)
          ? model.selection
          : SelectionRuntime.resolvePointerSelection({
              current: model.selection,
              elementId: target.id,
              event,
              options: context.getOptions().interaction?.selection,
            })
        context.applyCommand({
          type: 'select',
          ids: nextSelection,
        })
        const selected = new Set(nextSelection)
        const elements = model.elements
          .filter(item => selected.has(item.id))
          .filter(item => context.getElementRegistry().get(item.type)?.capabilities?.draggable !== false)
          .map(item => ({ ...item, data: { ...item.data }, style: { ...item.style } }))
        this.activeMove = {
          primary: { ...element, data: { ...element.data }, style: { ...element.style } },
          elements,
          startWorld: context.screenToWorld(eventPoint(event)),
        }
        this.runtime.dragShadow.begin(elements)
        return false
      },
      onPointerMove: (context, event) => {
        if (!this.activeMove) return false
        const current = context.screenToWorld(eventPoint(event))
        const snapped = this.snap.moveElement({
          element: this.activeMove.primary,
          raw: {
            x: this.activeMove.primary.x + current.x - this.activeMove.startWorld.x,
            y: this.activeMove.primary.y + current.y - this.activeMove.startWorld.y,
          },
          event,
        })
        const dx = snapped.x - this.activeMove.primary.x
        const dy = snapped.y - this.activeMove.primary.y
        this.activeMove.elements.forEach(element => {
          context.applyCommand({
            type: 'element.patch',
            id: element.id,
            patch: {
              x: element.x + dx,
              y: element.y + dy,
            },
          })
        })
        return false
      },
      onPointerUp: () => {
        this.activeMove = null
        this.runtime.dragShadow.clear()
        return false
      },
      onCancel: context => {
        if (this.activeMove) {
          for (const element of this.activeMove.elements) {
            context.applyCommand({
              type: 'element.patch',
              id: element.id,
              patch: {
                x: element.x,
                y: element.y,
              },
            })
          }
        }
        this.activeMove = null
        this.runtime.dragShadow.clear()
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
    this.activeWaypoint = null
    this.runtime.dragShadow.clear()
    this.runtime.connectionFlow.clear()
  }

  private completeConnection(context: ModelerPluginContext, target: ModelerHitTarget, fallbackPoint: ModelerPoint): boolean {
    const state = this.runtime.connection.get()
    const element = this.runtime.connectionFlow.completeAtTarget(context, target, fallbackPoint)
    if (!element) return false
    if (state?.origin === 'context-pad') context.tools.deactivate('connect')
    return true
  }

  private shouldKeepCurrentSelection(selection: Array<string>, elementId: string, event: MouseEvent): boolean {
    return selection.includes(elementId)
      && selection.length > 1
      && !event.shiftKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
  }
}
