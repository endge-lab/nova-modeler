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
import { BPMN_GROUP_TYPE } from '@/elements/bpmn/artifacts/group/bpmn-group.factory'
import {
  BPMN_PARTICIPANT_TYPE,
  isElementInsideBpmnParticipantContent,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import {
  isBpmnBoundaryEventAttachedTo,
} from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'

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

  private activeSegmentWaypoint: {
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
      hitTest: (context, event, target) => {
        if (event.button !== 0) return false
        if (target.type === 'port') return true
        if (!this.isConnectionToolActive(context.tools.getActiveId()) || target.type !== 'element') return false
        const state = this.runtime.connection.get()
        return state
          ? this.runtime.connectionFlow.canCompleteElement(context, target.id)
          : this.runtime.connectionFlow.canStart(context, target.id)
      },
      onPointerDown: (context, event) => {
        const point = eventPoint(event)
        const target = context.hitTest(point)
        const world = context.screenToWorld(point)
        if (this.isConnectionToolActive(context.tools.getActiveId()) && this.runtime.connection.get()) {
          this.completeConnection(context, target, world)
          return false
        }
        if (target.type === 'port') {
          this.runtime.connectionFlow.beginFromPort(
            context,
            target.elementId,
            target.portId,
            this.isConnectionToolActive(context.tools.getActiveId()) ? 'tool' : 'port-drag',
          )
          return false
        }
        if (this.isConnectionToolActive(context.tools.getActiveId()) && target.type === 'element') {
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
      hitTest: (_context, event, target) => event.button === 0
        && (target.type === 'edge-waypoint-handle' || target.type === 'edge-segment-handle'),
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'edge-waypoint-handle' && target.type !== 'edge-segment-handle') return false
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        if (!element || !isModelerEdgeElement(element)) return false
        const original = this.cloneEdge(element)
        if (target.type === 'edge-waypoint-handle') {
          this.activeWaypoint = { element: original, waypointIndex: target.waypointIndex }
          return false
        }
        const point = context.screenToWorld(eventPoint(event))
        const handle = this.runtime.edges.createSegmentHandleAtPoint(context, element, point)
        const waypointIndex = Math.min(target.segmentIndex, element.waypoints.length)
        const waypoints = [
          ...element.waypoints.slice(0, waypointIndex).map(item => ({ ...item })),
          { x: handle?.x ?? point.x, y: handle?.y ?? point.y },
          ...element.waypoints.slice(waypointIndex).map(item => ({ ...item })),
        ]
        context.applyCommand({
          type: 'element.patch',
          id: element.id,
          patch: { waypoints },
        })
        this.activeSegmentWaypoint = { element: original, waypointIndex }
        return false
      },
      onPointerMove: (context, event) => {
        const active = this.activeWaypoint ?? this.activeSegmentWaypoint
        if (!active) return false
        const point = context.screenToWorld(eventPoint(event))
        const current = context.getModel().elements.find(item => item.id === active.element.id)
        if (!current || !isModelerEdgeElement(current)) return false
        const waypoints = current.waypoints.map((waypoint, index) => index === active.waypointIndex
          ? { x: point.x, y: point.y }
          : { ...waypoint })
        context.applyCommand({
          type: 'element.patch',
          id: active.element.id,
          patch: { waypoints },
        })
        return false
      },
      onPointerUp: context => {
        const active = this.activeWaypoint ?? this.activeSegmentWaypoint
        if (active) this.optimizeActiveWaypoints(context, active.element.id)
        this.activeWaypoint = null
        this.activeSegmentWaypoint = null
        return false
      },
      onCancel: context => {
        const active = this.activeWaypoint ?? this.activeSegmentWaypoint
        if (active) {
          context.applyCommand({
            type: 'element.patch',
            id: active.element.id,
            patch: {
              waypoints: active.element.waypoints.map(point => ({ ...point })),
            },
          })
        }
        this.activeWaypoint = null
        this.activeSegmentWaypoint = null
      },
    }))
    addDisposer(this.context.gestures.add({
      id: 'modeler-elements:select',
      priority: 40,
      hitTest: (_context, event, target) => event.button === 0 && this.resolveTargetElementId(target) !== null,
      onPointerDown: (context, event) => {
        const point = eventPoint(event)
        const target = context.hitTest(point)
        const elementId = this.resolveTargetElementId(target)
        if (!elementId) return false
        this.runtime.contextPadAnchors.set(elementId, point, target.type === 'element-part'
          ? { partType: target.partType, partId: target.partId }
          : undefined)
        context.applyCommand({
          type: 'select',
          ids: SelectionRuntime.resolvePointerSelection({
            current: context.getModel().selection,
            elementId,
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
      hitTest: (context, event, target) => {
        const elementId = this.resolveTargetElementId(target)
        if (event.button !== 0 || !elementId) return false
        const element = context.getModel().elements.find(item => item.id === elementId)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        return !!element && definition?.capabilities?.draggable !== false
      },
      onPointerDown: (context, event) => {
        const point = eventPoint(event)
        const target = context.hitTest(point)
        const elementId = this.resolveTargetElementId(target)
        if (!elementId) return false
        const model = context.getModel()
        const element = model.elements.find(item => item.id === elementId)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        if (!element || definition?.capabilities?.draggable === false) return false
        this.runtime.contextPadAnchors.set(elementId, point, target.type === 'element-part'
          ? { partType: target.partType, partId: target.partId }
          : undefined)
        const nextSelection = this.shouldKeepCurrentSelection(model.selection, elementId, event)
          ? model.selection
          : SelectionRuntime.resolvePointerSelection({
              current: model.selection,
              elementId,
              event,
              options: context.getOptions().interaction?.selection,
            })
        context.applyCommand({
          type: 'select',
          ids: nextSelection,
        })
        const elements = this.resolveMoveElements(context, model.elements, nextSelection)
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
    this.activeSegmentWaypoint = null
    this.runtime.dragShadow.clear()
    this.runtime.edgeSegmentHover.clear()
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

  private isConnectionToolActive(activeToolId: string | null): boolean {
    return activeToolId === 'connect' || activeToolId?.startsWith('connect:') === true
  }

  private resolveMoveElements(
    context: ModelerPluginContext,
    modelElements: Array<ModelerElement>,
    selection: Array<string>,
  ): Array<ModelerElement> {
    const selected = new Set(selection)
    const moveIds = new Set<string>()
    for (const element of modelElements) {
      if (selected.has(element.id) && this.isElementDraggable(context, element)) moveIds.add(element.id)
    }
    const selectedGroups = modelElements.filter(element => selected.has(element.id) && element.type === BPMN_GROUP_TYPE)
    for (const group of selectedGroups) {
      for (const element of modelElements) {
        if (moveIds.has(element.id) || element.id === group.id || isModelerEdgeElement(element)) continue
        if (!this.isElementDraggable(context, element)) continue
        if (this.isElementFullyInsideGroup(element, group)) moveIds.add(element.id)
      }
    }
    const selectedParticipants = modelElements
      .filter((element): element is BpmnParticipantElement => selected.has(element.id) && element.type === BPMN_PARTICIPANT_TYPE)
    for (const participant of selectedParticipants) {
      for (const element of modelElements) {
        if (moveIds.has(element.id) || element.id === participant.id || isModelerEdgeElement(element)) continue
        if (!this.isElementDraggable(context, element)) continue
        if (isElementInsideBpmnParticipantContent(element, participant)) moveIds.add(element.id)
      }
    }
    for (const selectedId of selected) {
      for (const element of modelElements) {
        if (moveIds.has(element.id) || isModelerEdgeElement(element)) continue
        if (isBpmnBoundaryEventAttachedTo(element, selectedId)) moveIds.add(element.id)
      }
    }
    return modelElements
      .filter(element => moveIds.has(element.id))
      .map(element => this.cloneElement(element))
  }

  private resolveTargetElementId(target: ModelerHitTarget): string | null {
    if (target.type === 'element') return target.id
    if (target.type === 'element-part') return target.id
    return null
  }

  private isElementDraggable(context: ModelerPluginContext, element: ModelerElement): boolean {
    return context.getElementRegistry().get(element.type)?.capabilities?.draggable !== false
  }

  private isElementFullyInsideGroup(element: ModelerElement, group: ModelerElement): boolean {
    return element.x >= group.x
      && element.y >= group.y
      && element.x + element.width <= group.x + group.width
      && element.y + element.height <= group.y + group.height
  }

  private cloneElement(element: ModelerElement): ModelerElement {
    if (isModelerEdgeElement(element)) return this.cloneEdge(element)
    return { ...element, data: { ...element.data }, style: { ...element.style } }
  }

  private optimizeActiveWaypoints(context: ModelerPluginContext, elementId: string): void {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || !isModelerEdgeElement(element)) return
    const waypoints = this.runtime.routeOptimizer.optimizeWaypoints(context, element, element.waypoints)
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: { waypoints },
    })
  }

  private cloneEdge(element: ModelerEdgeElement): ModelerEdgeElement {
    return {
      ...element,
      source: { ...element.source, point: element.source.point ? { ...element.source.point } : undefined },
      target: { ...element.target, point: element.target.point ? { ...element.target.point } : undefined },
      waypoints: element.waypoints.map(point => ({ ...point })),
      data: { ...element.data },
      style: { ...element.style },
    }
  }
}
