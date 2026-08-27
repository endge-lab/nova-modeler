import type {
  ModelerEdgeElement,
  ModelerElement,
  ModelerExternalLabelGeometry,
  ModelerHitTarget,
  ModelerPluginContext,
  ModelerPoint,
  ModelerResizeHandle,
} from '@/domain/types/index'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import type { ElementsRuntime } from '@/plugins/elements/model/ElementsRuntime'
import { isModelerEdgeElement } from '@/domain/types/index'
import { BPMN_GROUP_TYPE } from '@/elements/bpmn/artifacts/group/bpmn-group.factory'
import {
  isBpmnBoundaryEventAttachedTo,
} from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import {
  BPMN_PARTICIPANT_TYPE,
  createBpmnParticipantElement,
  isElementInsideBpmnParticipantContent,
  resizeBpmnParticipantLaneBoundary,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import { SelectionRuntime } from '@/model/selection/SelectionRuntime'
import { SnapRuntime } from '@/model/snap/SnapRuntime'
import { eventPoint } from '@/tools/event-point'

export class ElementsGestures {
  private _activeResize: {
    element: ModelerElement
    handle: ModelerResizeHandle
    startWorld: ModelerPoint
  } | null = null

  private _activeLaneResize: {
    element: BpmnParticipantElement
    laneId: string
    orientation: 'horizontal' | 'vertical'
    startWorld: ModelerPoint
  } | null = null

  private _activeMove: {
    primary: ModelerElement
    elements: Array<ModelerElement>
    startWorld: ModelerPoint
  } | null = null

  private _activeExternalLabelMove: {
    elementId: string
    startWorld: ModelerPoint
    startGeometry: ModelerExternalLabelGeometry
  } | null = null

  private _activeExternalLabelResize: {
    elementId: string
    handle: ModelerResizeHandle
    startWorld: ModelerPoint
    startGeometry: ModelerExternalLabelGeometry
  } | null = null

  private _activeRotate: {
    element: ModelerElement
    center: ModelerPoint
    startAngle: number
    startRotation: number
    snapDegrees?: number
  } | null = null

  private _activeWaypoint: {
    element: ModelerEdgeElement
    waypointIndex: number
  } | null = null

  private _activeSegmentWaypoint: {
    element: ModelerEdgeElement
    waypointIndex: number
  } | null = null

  private readonly _snap: SnapRuntime

  constructor(
    private readonly _context: ModelerPluginContext,
    private readonly _runtime: ElementsRuntime,
  ) {
    this._snap = new SnapRuntime(_context)
  }

  bind(addDisposer: (dispose: () => void) => void): void {
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:create-flow',
      priority: 120,
      hitTest: (context, event, target) => {
        if (event.button !== 0) {
          return false
        }
        if (target.type === 'port') {
          return true
        }
        if (!this._isConnectionToolActive(context.tools.getActiveId()) || target.type !== 'element') {
          return false
        }
        const state = this._runtime.connection.get()
        return state
          ? this._runtime.connectionFlow.canCompleteElement(context, target.id)
          : this._runtime.connectionFlow.canStart(context, target.id)
      },
      onPointerDown: (context, event) => {
        const point = eventPoint(event)
        const target = context.hitTest(point)
        const world = context.screenToWorld(point)
        if (this._isConnectionToolActive(context.tools.getActiveId()) && this._runtime.connection.get()) {
          this._completeConnection(context, target, world)
          return false
        }
        if (target.type === 'port') {
          this._runtime.connectionFlow.beginFromPort(
            context,
            target.elementId,
            target.portId,
            this._isConnectionToolActive(context.tools.getActiveId()) ? 'tool' : 'port-drag',
          )
          return false
        }
        if (this._isConnectionToolActive(context.tools.getActiveId()) && target.type === 'element') {
          this._runtime.connectionFlow.beginFromElement(context, target.id, 'tool', world)
          return false
        }
        return false
      },
      onPointerMove: (context, event) => {
        const point = eventPoint(event)
        if (!this._runtime.connection.get()) {
          return false
        }
        this._runtime.connectionFlow.updatePreviewToPoint(
          context,
          context.screenToWorld(point),
          context.hitTest(point),
        )
        return false
      },
      onPointerUp: (context, event) => {
        const state = this._runtime.connection.get()
        if (!state) {
          return false
        }
        const point = eventPoint(event)
        const completed = this._completeConnection(context, context.hitTest(point), context.screenToWorld(point))
        if (!completed && state.origin === 'port-drag') {
          this._runtime.connectionFlow.clear()
        }
        return false
      },
      onCancel: () => {
        this._runtime.connectionFlow.clear()
      },
    }))
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:external-label-resize',
      priority: 118,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'external-label-resize-handle',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'external-label-resize-handle') {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        if (!element) {
          return false
        }
        const geometry = context.externalLabels.createGeometry(context, element)
        if (!geometry) {
          return false
        }
        context.externalLabels.select(element.id)
        context.applyCommand({ type: 'select', ids: [element.id] })
        context.applyCommand({
          type: 'element.patch',
          id: element.id,
          patch: { data: { ...(element.data ?? {}), label: geometry } },
        })
        this._activeExternalLabelResize = {
          elementId: element.id,
          handle: target.handle,
          startWorld: context.screenToWorld(eventPoint(event)),
          startGeometry: geometry,
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this._activeExternalLabelResize) {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === this._activeExternalLabelResize?.elementId)
        if (!element) {
          return false
        }
        const current = context.screenToWorld(eventPoint(event))
        const geometry = context.externalLabels.resizeGeometry(
          this._activeExternalLabelResize.startGeometry,
          this._activeExternalLabelResize.handle,
          current.x - this._activeExternalLabelResize.startWorld.x,
          current.y - this._activeExternalLabelResize.startWorld.y,
        )
        context.applyCommand({
          type: 'element.patch',
          id: element.id,
          patch: { data: { ...(element.data ?? {}), label: geometry } },
        })
        return false
      },
      onPointerUp: () => {
        this._activeExternalLabelResize = null
        return false
      },
      onCancel: (context) => {
        if (this._activeExternalLabelResize) {
          const element = context.getModel().elements.find(item => item.id === this._activeExternalLabelResize?.elementId)
          if (element) {
            context.applyCommand({
              type: 'element.patch',
              id: element.id,
              patch: { data: { ...(element.data ?? {}), label: this._activeExternalLabelResize.startGeometry } },
            })
          }
        }
        this._activeExternalLabelResize = null
      },
    }))
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:external-label-move',
      priority: 92,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'external-label',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'external-label') {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        if (!element) {
          return false
        }
        const geometry = context.externalLabels.createGeometry(context, element)
        if (!geometry) {
          return false
        }
        context.externalLabels.select(element.id)
        context.applyCommand({ type: 'select', ids: [element.id] })
        context.applyCommand({
          type: 'element.patch',
          id: element.id,
          patch: { data: { ...(element.data ?? {}), label: geometry } },
        })
        this._activeExternalLabelMove = {
          elementId: element.id,
          startWorld: context.screenToWorld(eventPoint(event)),
          startGeometry: geometry,
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this._activeExternalLabelMove) {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === this._activeExternalLabelMove?.elementId)
        if (!element) {
          return false
        }
        const current = context.screenToWorld(eventPoint(event))
        const geometry = context.externalLabels.moveGeometry(
          this._activeExternalLabelMove.startGeometry,
          current.x - this._activeExternalLabelMove.startWorld.x,
          current.y - this._activeExternalLabelMove.startWorld.y,
        )
        context.applyCommand({
          type: 'element.patch',
          id: element.id,
          patch: { data: { ...(element.data ?? {}), label: geometry } },
        })
        return false
      },
      onPointerUp: () => {
        this._activeExternalLabelMove = null
        return false
      },
      onCancel: (context) => {
        if (this._activeExternalLabelMove) {
          const element = context.getModel().elements.find(item => item.id === this._activeExternalLabelMove?.elementId)
          if (element) {
            context.applyCommand({
              type: 'element.patch',
              id: element.id,
              patch: { data: { ...(element.data ?? {}), label: this._activeExternalLabelMove.startGeometry } },
            })
          }
        }
        this._activeExternalLabelMove = null
      },
    }))
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:waypoint',
      priority: 115,
      hitTest: (_context, event, target) => event.button === 0
        && (target.type === 'edge-waypoint-handle' || target.type === 'edge-segment-handle'),
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'edge-waypoint-handle' && target.type !== 'edge-segment-handle') {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        if (!element || !isModelerEdgeElement(element)) {
          return false
        }
        const original = this._cloneEdge(element)
        if (target.type === 'edge-waypoint-handle') {
          this._activeWaypoint = { element: original, waypointIndex: target.waypointIndex }
          return false
        }
        const point = context.screenToWorld(eventPoint(event))
        const handle = this._runtime.edges.createSegmentHandleAtPoint(context, element, point)
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
        this._activeSegmentWaypoint = { element: original, waypointIndex }
        return false
      },
      onPointerMove: (context, event) => {
        const active = this._activeWaypoint ?? this._activeSegmentWaypoint
        if (!active) {
          return false
        }
        const point = context.screenToWorld(eventPoint(event))
        const current = context.getModel().elements.find(item => item.id === active.element.id)
        if (!current || !isModelerEdgeElement(current)) {
          return false
        }
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
      onPointerUp: (context) => {
        const active = this._activeWaypoint ?? this._activeSegmentWaypoint
        if (active) {
          this._optimizeActiveWaypoints(context, active.element.id)
        }
        this._activeWaypoint = null
        this._activeSegmentWaypoint = null
        return false
      },
      onCancel: (context) => {
        const active = this._activeWaypoint ?? this._activeSegmentWaypoint
        if (active) {
          context.applyCommand({
            type: 'element.patch',
            id: active.element.id,
            patch: {
              waypoints: active.element.waypoints.map(point => ({ ...point })),
            },
          })
        }
        this._activeWaypoint = null
        this._activeSegmentWaypoint = null
      },
    }))
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:select',
      priority: 40,
      hitTest: (_context, event, target) => event.button === 0 && this._resolveTargetElementId(target) !== null,
      onPointerDown: (context, event) => {
        const point = eventPoint(event)
        const target = context.hitTest(point)
        const elementId = this._resolveTargetElementId(target)
        if (!elementId) {
          return false
        }
        context.externalLabels.clearSelection()
        this._runtime.contextPadAnchors.set(elementId, point, target.type === 'element-part'
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
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:move',
      priority: 90,
      hitTest: (context, event, target) => {
        const elementId = this._resolveTargetElementId(target)
        if (event.button !== 0 || !elementId) {
          return false
        }
        if (context.tools.getActiveId() === 'marqueeSelection') {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === elementId)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        return !!element && definition?.capabilities?.draggable !== false
      },
      onPointerDown: (context, event) => {
        if (context.tools.getActiveId() === 'marqueeSelection') {
          return false
        }
        const point = eventPoint(event)
        const target = context.hitTest(point)
        const elementId = this._resolveTargetElementId(target)
        if (!elementId) {
          return false
        }
        const model = context.getModel()
        const element = model.elements.find(item => item.id === elementId)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        if (!element || definition?.capabilities?.draggable === false) {
          return false
        }
        this._runtime.contextPadAnchors.set(elementId, point, target.type === 'element-part'
          ? { partType: target.partType, partId: target.partId }
          : undefined)
        const nextSelection = this._shouldKeepCurrentSelection(model.selection, elementId, event)
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
        const elements = this._resolveMoveElements(context, model.elements, nextSelection)
        this._activeMove = {
          primary: { ...element, data: { ...element.data }, style: { ...element.style } },
          elements,
          startWorld: context.screenToWorld(eventPoint(event)),
        }
        if (context.getOptions().interaction?.dragShadow !== false) {
          this._runtime.dragShadow.begin(elements)
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this._activeMove) {
          return false
        }
        const current = context.screenToWorld(eventPoint(event))
        const snapped = this._snap.moveElement({
          element: this._activeMove.primary,
          raw: {
            x: this._activeMove.primary.x + current.x - this._activeMove.startWorld.x,
            y: this._activeMove.primary.y + current.y - this._activeMove.startWorld.y,
          },
          event,
        })
        const dx = snapped.x - this._activeMove.primary.x
        const dy = snapped.y - this._activeMove.primary.y
        this._activeMove.elements.forEach((element) => {
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
        this._activeMove = null
        this._runtime.dragShadow.clear()
        return false
      },
      onCancel: (context) => {
        if (this._activeMove) {
          for (const element of this._activeMove.elements) {
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
        this._activeMove = null
        this._runtime.dragShadow.clear()
      },
    }))
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:bpmn-lane-resize',
      priority: 105,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'bpmn-lane-resize-handle',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'bpmn-lane-resize-handle') {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        if (!element || element.type !== BPMN_PARTICIPANT_TYPE) {
          return false
        }
        this._activeLaneResize = {
          element: this._cloneParticipant(element as BpmnParticipantElement),
          laneId: target.laneId,
          orientation: target.orientation,
          startWorld: context.screenToWorld(eventPoint(event)),
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this._activeLaneResize) {
          return false
        }
        const current = context.screenToWorld(eventPoint(event))
        const delta = this._activeLaneResize.orientation === 'vertical'
          ? current.x - this._activeLaneResize.startWorld.x
          : current.y - this._activeLaneResize.startWorld.y
        context.applyCommand({
          type: 'element.replace',
          id: this._activeLaneResize.element.id,
          element: resizeBpmnParticipantLaneBoundary(
            this._activeLaneResize.element,
            this._activeLaneResize.laneId,
            delta,
          ),
        })
        return false
      },
      onPointerUp: () => {
        this._activeLaneResize = null
        return false
      },
      onCancel: (context) => {
        if (this._activeLaneResize) {
          context.applyCommand({
            type: 'element.replace',
            id: this._activeLaneResize.element.id,
            element: this._activeLaneResize.element,
          })
        }
        this._activeLaneResize = null
      },
    }))
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:resize',
      priority: 100,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'resize-handle',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'resize-handle') {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        if (!element) {
          return false
        }
        this._activeResize = {
          element: { ...element, data: { ...element.data }, style: { ...element.style } },
          handle: target.handle,
          startWorld: context.screenToWorld(eventPoint(event)),
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this._activeResize) {
          return false
        }
        const current = context.screenToWorld(eventPoint(event))
        const definition = context.getElementRegistry().get(this._activeResize.element.type)
        const minSize = this._runtime.bounds.getMinSize(definition)
        const delta = this._runtime.geometry.rotateDelta(
          {
            x: current.x - this._activeResize.startWorld.x,
            y: current.y - this._activeResize.startWorld.y,
          },
          -(this._activeResize.element.rotation ?? 0),
        )
        const rawBounds = this._runtime.bounds.resizeBounds({
          element: this._activeResize.element,
          handle: this._activeResize.handle,
          dx: delta.x,
          dy: delta.y,
          minSize,
        })
        context.applyCommand({
          type: 'element.resize',
          id: this._activeResize.element.id,
          bounds: this._snap.resizeElement({
            element: this._activeResize.element,
            handle: this._activeResize.handle,
            rawBounds,
            minSize,
            event,
          }),
        })
        return false
      },
      onPointerUp: () => {
        this._activeResize = null
        return false
      },
      onCancel: () => {
        this._activeResize = null
      },
    }))
    addDisposer(this._context.gestures.add({
      id: 'modeler-elements:rotate',
      priority: 110,
      hitTest: (_context, event, target) => event.button === 0 && target.type === 'rotate-handle',
      onPointerDown: (context, event) => {
        const target = context.hitTest(eventPoint(event))
        if (target.type !== 'rotate-handle') {
          return false
        }
        const element = context.getModel().elements.find(item => item.id === target.elementId)
        const definition = element ? context.getElementRegistry().get(element.type) : undefined
        const rotatable = definition?.capabilities?.rotatable
        if (!element || !rotatable) {
          return false
        }
        const center = this._runtime.geometry.elementCenter(element)
        const pointer = context.screenToWorld(eventPoint(event))
        this._activeRotate = {
          element: { ...element, data: { ...element.data }, style: { ...element.style } },
          center,
          startAngle: this._runtime.geometry.angleBetween(center, pointer),
          startRotation: element.rotation ?? 0,
          snapDegrees: rotatable.snapDegrees,
        }
        return false
      },
      onPointerMove: (context, event) => {
        if (!this._activeRotate) {
          return false
        }
        const pointer = context.screenToWorld(eventPoint(event))
        const rotation = this._activeRotate.startRotation
          + this._runtime.geometry.angleBetween(this._activeRotate.center, pointer)
          - this._activeRotate.startAngle
        context.applyCommand({
          type: 'element.rotate',
          id: this._activeRotate.element.id,
          rotation: event.shiftKey
            ? this._runtime.geometry.snapRadians(rotation, this._activeRotate.snapDegrees)
            : rotation,
        })
        return false
      },
      onPointerUp: () => {
        this._activeRotate = null
        return false
      },
      onCancel: () => {
        this._activeRotate = null
      },
    }))
  }

  dispose(): void {
    this._activeResize = null
    this._activeLaneResize = null
    this._activeMove = null
    this._activeExternalLabelMove = null
    this._activeExternalLabelResize = null
    this._activeRotate = null
    this._activeWaypoint = null
    this._activeSegmentWaypoint = null
    this._runtime.dragShadow.clear()
    this._runtime.edgeSegmentHover.clear()
    this._runtime.connectionFlow.clear()
  }

  private _completeConnection(context: ModelerPluginContext, target: ModelerHitTarget, fallbackPoint: ModelerPoint): boolean {
    const state = this._runtime.connection.get()
    const element = this._runtime.connectionFlow.completeAtTarget(context, target, fallbackPoint)
    if (!element) {
      return false
    }
    if (state?.origin === 'context-pad') {
      context.tools.deactivate('connect')
    }
    return true
  }

  private _shouldKeepCurrentSelection(selection: Array<string>, elementId: string, event: MouseEvent): boolean {
    return selection.includes(elementId)
      && selection.length > 1
      && !event.shiftKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
  }

  private _isConnectionToolActive(activeToolId: string | null): boolean {
    return activeToolId === 'connect' || activeToolId?.startsWith('connect:') === true
  }

  private _resolveMoveElements(
    context: ModelerPluginContext,
    modelElements: Array<ModelerElement>,
    selection: Array<string>,
  ): Array<ModelerElement> {
    const selected = new Set(selection)
    const moveIds = new Set<string>()
    for (const element of modelElements) {
      if (selected.has(element.id) && this._isElementDraggable(context, element)) {
        moveIds.add(element.id)
      }
    }
    const selectedGroups = modelElements.filter(element => selected.has(element.id) && element.type === BPMN_GROUP_TYPE)
    for (const group of selectedGroups) {
      for (const element of modelElements) {
        if (moveIds.has(element.id) || element.id === group.id || isModelerEdgeElement(element)) {
          continue
        }
        if (!this._isElementDraggable(context, element)) {
          continue
        }
        if (this._isElementFullyInsideGroup(element, group)) {
          moveIds.add(element.id)
        }
      }
    }
    const selectedParticipants = modelElements
      .filter((element): element is BpmnParticipantElement => selected.has(element.id) && element.type === BPMN_PARTICIPANT_TYPE)
    for (const participant of selectedParticipants) {
      for (const element of modelElements) {
        if (moveIds.has(element.id) || element.id === participant.id || isModelerEdgeElement(element)) {
          continue
        }
        if (!this._isElementDraggable(context, element)) {
          continue
        }
        if (isElementInsideBpmnParticipantContent(element, participant)) {
          moveIds.add(element.id)
        }
      }
    }
    for (const selectedId of selected) {
      for (const element of modelElements) {
        if (moveIds.has(element.id) || isModelerEdgeElement(element)) {
          continue
        }
        if (isBpmnBoundaryEventAttachedTo(element, selectedId)) {
          moveIds.add(element.id)
        }
      }
    }
    return modelElements
      .filter(element => moveIds.has(element.id))
      .map(element => this._cloneElement(element))
  }

  private _resolveTargetElementId(target: ModelerHitTarget): string | null {
    if (target.type === 'element') {
      return target.id
    }
    if (target.type === 'element-part') {
      return target.id
    }
    if (target.type === 'external-label') {
      return target.elementId
    }
    return null
  }

  private _isElementDraggable(context: ModelerPluginContext, element: ModelerElement): boolean {
    return context.getElementRegistry().get(element.type)?.capabilities?.draggable !== false
  }

  private _isElementFullyInsideGroup(element: ModelerElement, group: ModelerElement): boolean {
    return element.x >= group.x
      && element.y >= group.y
      && element.x + element.width <= group.x + group.width
      && element.y + element.height <= group.y + group.height
  }

  private _cloneElement(element: ModelerElement): ModelerElement {
    if (isModelerEdgeElement(element)) {
      return this._cloneEdge(element)
    }
    if (element.type === BPMN_PARTICIPANT_TYPE) {
      return this._cloneParticipant(element as BpmnParticipantElement)
    }
    return { ...element, data: { ...element.data }, style: { ...element.style } }
  }

  private _cloneParticipant(element: BpmnParticipantElement): BpmnParticipantElement {
    return createBpmnParticipantElement({
      ...element,
      data: {
        ...(element.data ?? {}),
        lanes: (element.data?.lanes ?? []).map(lane => ({
          ...lane,
          style: lane.style ? { ...lane.style } : undefined,
        })),
      },
      style: { ...element.style },
    })
  }

  private _optimizeActiveWaypoints(context: ModelerPluginContext, elementId: string): void {
    const element = context.getModel().elements.find(item => item.id === elementId)
    if (!element || !isModelerEdgeElement(element)) {
      return
    }
    const waypoints = this._runtime.routeOptimizer.optimizeWaypoints(context, element, element.waypoints)
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: { waypoints },
    })
  }

  private _cloneEdge(element: ModelerEdgeElement): ModelerEdgeElement {
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
