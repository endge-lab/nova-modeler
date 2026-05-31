import type {
  ModelerElement,
  ModelerEdgeElement,
  ModelerEdgeEndpoint,
  ModelerPoint,
  ModelerPluginContext,
  ModelerResizeHandle,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { SnapRuntime } from '@/model/snap/SnapRuntime'
import { SelectionRuntime } from '@/model/selection/SelectionRuntime'
import { eventPoint } from '@/tools/event-point'
import type { ElementsRuntime } from '@/plugins/elements/model/ElementsRuntime'
import { createBpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.factory'
import { createBpmnFlowEndpoint } from '@/elements/bpmn/flow/bpmn-flow.definition'

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

  private activeFlowCreate: {
    source: ModelerEdgeEndpoint
    sourceElementId: string
    sourcePortId: string
    sourcePoint: ModelerPoint
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
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'port',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'port') return false
        const sourcePoint = this.resolvePortPoint(context, target.elementId, target.portId)
        if (!sourcePoint || !this.canStartFlow(context, target.elementId)) return false
        this.activeFlowCreate = {
          source: createBpmnFlowEndpoint(target.elementId, target.portId, sourcePoint),
          sourceElementId: target.elementId,
          sourcePortId: target.portId,
          sourcePoint,
        }
        this.runtime.edgePreview.set(createBpmnFlowElement({
          id: 'bpmn-flow-preview',
          source: this.activeFlowCreate.source,
          target: { point: sourcePoint },
        }))
        return false
      },
      onPointerMove: (context, event) => {
        if (!this.activeFlowCreate) return false
        const point = eventPoint(event)
        const target = context.hitTest(point)
        const world = context.screenToWorld(point)
        const targetEndpoint = this.resolveFlowTargetEndpoint(context, target, world)
        const targetPoint = targetEndpoint.point ?? world
        this.runtime.edgePreview.set(createBpmnFlowElement({
          id: 'bpmn-flow-preview',
          source: this.activeFlowCreate.source,
          target: targetEndpoint,
          waypoints: [this.midpoint(this.activeFlowCreate.sourcePoint, targetPoint)],
        }))
        return false
      },
      onPointerUp: (context, event) => {
        if (!this.activeFlowCreate) return false
        const target = context.hitTest(eventPoint(event))
        const targetEndpoint = this.resolveFlowTargetEndpoint(context, target, context.screenToWorld(eventPoint(event)))
        if (target.type === 'port' && this.canCompleteFlow(context, target.elementId, target.portId)) {
          const targetPoint = targetEndpoint.point ?? context.screenToWorld(eventPoint(event))
          const element = createBpmnFlowElement({
            id: `bpmn-flow-${Date.now().toString(36)}`,
            source: this.activeFlowCreate.source,
            target: targetEndpoint,
            waypoints: [this.midpoint(this.activeFlowCreate.sourcePoint, targetPoint)],
          })
          context.applyCommand({ type: 'element.add', element })
          context.applyCommand({ type: 'select', ids: [element.id] })
        }
        this.activeFlowCreate = null
        this.runtime.edgePreview.clear()
        return false
      },
      onCancel: () => {
        this.activeFlowCreate = null
        this.runtime.edgePreview.clear()
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
    this.activeFlowCreate = null
    this.activeWaypoint = null
    this.runtime.dragShadow.clear()
    this.runtime.edgePreview.clear()
  }

  private resolveFlowTargetEndpoint(context: ModelerPluginContext, target: ReturnType<ModelerPluginContext['hitTest']>, fallbackPoint: ModelerPoint): ModelerEdgeEndpoint {
    if (target.type === 'port' && this.canCompleteFlow(context, target.elementId, target.portId)) {
      const portPoint = this.resolvePortPoint(context, target.elementId, target.portId) ?? fallbackPoint
      return createBpmnFlowEndpoint(target.elementId, target.portId, portPoint)
    }
    return { point: fallbackPoint }
  }

  private resolvePortPoint(context: ModelerPluginContext, elementId: string, portId: string): ModelerPoint | null {
    const element = context.getModel().elements.find(item => item.id === elementId)
    const definition = element ? context.getElementRegistry().get(element.type) : undefined
    if (!element || !definition) return null
    const ports = this.runtime.ports.createElementPorts(element, definition.getPorts?.(context, element) ?? [])
    const port = ports.find(item => item.id === portId)
    return port ? { x: port.x, y: port.y } : null
  }

  private canStartFlow(context: ModelerPluginContext, elementId: string): boolean {
    const element = context.getModel().elements.find(item => item.id === elementId)
    const definition = element ? context.getElementRegistry().get(element.type) : undefined
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.outgoing !== false
  }

  private canCompleteFlow(context: ModelerPluginContext, elementId: string, portId: string): boolean {
    if (!this.activeFlowCreate) return false
    if (this.activeFlowCreate.sourceElementId === elementId && this.activeFlowCreate.sourcePortId === portId) return false
    const element = context.getModel().elements.find(item => item.id === elementId)
    const definition = element ? context.getElementRegistry().get(element.type) : undefined
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.incoming !== false
  }

  private midpoint(a: ModelerPoint, b: ModelerPoint): ModelerPoint {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    }
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
