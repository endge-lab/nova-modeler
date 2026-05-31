import type { NovaTemplateChildSchema } from '@endge/nova'
import { Modeler } from '@/config/schema.config'
import type {
  ModelerEdgeElement,
  ModelerElement,
  ModelerPluginContext,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { MODELER_PORT_RADIUS } from '@/plugins/elements/elements.constants'
import type { ElementsRuntime } from '@/plugins/elements/model/ElementsRuntime'

export class ElementsLayer {
  private disposeLinksLayer: (() => void) | undefined
  private disposeInteractionLayer: (() => void) | undefined
  private readonly disposeShadow: () => void
  private readonly disposePreview: () => void
  private readonly disposeConnection: () => void
  private readonly disposeSegmentHover: () => void

  constructor(
    private readonly context: ModelerPluginContext,
    private readonly runtime: ElementsRuntime,
  ) {
    this.disposeShadow = this.runtime.dragShadow.subscribe(() => this.sync())
    this.disposePreview = this.runtime.edgePreview.subscribe(() => this.sync())
    this.disposeConnection = this.runtime.connection.subscribe(() => this.sync())
    this.disposeSegmentHover = this.runtime.edgeSegmentHover.subscribe(() => this.sync())
  }

  sync(): void {
    const linkSchemas: Array<NovaTemplateChildSchema> = []
    const interactionSchemas: Array<NovaTemplateChildSchema> = []
    const model = this.context.getModel()
    const selected = new Set(model.selection)
    const connectionTargetId = this.runtime.connection.get()?.targetElementId
    for (const element of this.runtime.dragShadow.getElements()) {
      const definition = this.context.getElementRegistry().get(element.type)
      if (!definition) continue
      interactionSchemas.push(this.createShadowSchema(definition.render({
        ...this.context,
        selected: false,
      }, this.createShadowElement(element))))
    }
    const edges = model.elements.filter(element => this.runtime.edges.isEdge(element))
    const nodes = model.elements.filter(element => !this.runtime.edges.isEdge(element))
    for (const element of edges) {
      this.appendEdgeSchema(linkSchemas, element, selected)
      this.appendEdgeInteractionSchema(interactionSchemas, element, selected)
    }
    for (const element of nodes) {
      this.appendNodeSchema(interactionSchemas, element, selected, connectionTargetId)
    }
    const preview = this.runtime.edgePreview.get()
    if (preview) {
      const definition = this.context.getElementRegistry().get(preview.type)
      if (definition) {
        linkSchemas.push(definition.render({ ...this.context, selected: false }, preview))
        const schema = linkSchemas[linkSchemas.length - 1] as NovaTemplateChildSchema & { props?: Record<string, unknown> }
        schema.id = `${preview.id}:preview`
        schema.props = { ...(schema.props ?? {}), preview: true }
      }
    }
    this.disposeLinksLayer = this.context.layers.reconcile('links', 'modeler-elements-links', linkSchemas)
    this.disposeInteractionLayer = this.context.layers.reconcile('interaction', 'modeler-elements', interactionSchemas)
    this.context.invalidate('render')
  }

  private appendEdgeSchema(
    schemas: Array<NovaTemplateChildSchema>,
    element: ModelerElement,
    selected: Set<string>,
  ): void {
    const definition = this.context.getElementRegistry().get(element.type)
    if (!definition) return
    schemas.push(definition.render({ ...this.context, selected: selected.has(element.id) }, element))
  }

  private appendEdgeInteractionSchema(
    schemas: Array<NovaTemplateChildSchema>,
    element: ModelerElement,
    selected: Set<string>,
  ): void {
    if (!selected.has(element.id) || !isModelerEdgeElement(element)) return
    const segmentHover = this.runtime.edgeSegmentHover.get()
    if (segmentHover?.elementId === element.id) {
      schemas.push({
        type: Modeler.EdgeWaypointHandleView,
        id: `${element.id}:segment:${segmentHover.segmentIndex}`,
        props: { handle: segmentHover, viewport: this.context.getViewport() },
      })
    }
    for (const handle of this.runtime.edges.createWaypointHandles(element as ModelerEdgeElement)) {
      schemas.push({
        type: Modeler.EdgeWaypointHandleView,
        id: `${element.id}:waypoint:${handle.waypointIndex}`,
        props: { handle, viewport: this.context.getViewport() },
      })
    }
  }

  private appendNodeSchema(
    schemas: Array<NovaTemplateChildSchema>,
    element: ModelerElement,
    selected: Set<string>,
    connectionTargetId?: string,
  ): void {
    const definition = this.context.getElementRegistry().get(element.type)
    if (!definition) return
    const isSelected = selected.has(element.id)
    schemas.push(definition.render({ ...this.context, selected: isSelected || connectionTargetId === element.id }, element))
    if (!isSelected) return
    const rotateHandle = this.runtime.handles.createRotateHandle(element, definition)
    if (rotateHandle) {
      schemas.push({
        type: Modeler.RotateHandleView,
        id: `${element.id}:rotate`,
        props: { handle: rotateHandle, viewport: this.context.getViewport() },
      })
    }
    for (const handle of this.runtime.handles.createResizeHandles(element, definition)) {
      schemas.push({
        type: Modeler.ResizeHandleView,
        id: `${element.id}:resize:${handle.handle}`,
        props: { handle, viewport: this.context.getViewport() },
      })
    }
    if (definition.capabilities?.ports === false) return
    for (const port of this.runtime.ports.createElementPorts(element, definition.getPorts?.(this.context, element) ?? [])) {
      schemas.push({
        type: Modeler.PortView,
        id: `${element.id}:port:${port.id}`,
        props: { port, viewport: this.context.getViewport(), radius: MODELER_PORT_RADIUS },
      })
    }
  }

  dispose(): void {
    this.disposeShadow()
    this.disposePreview()
    this.disposeConnection()
    this.disposeSegmentHover()
    this.disposeLinksLayer?.()
    this.disposeInteractionLayer?.()
    this.disposeLinksLayer = undefined
    this.disposeInteractionLayer = undefined
  }

  private createShadowElement(element: ModelerElement): ModelerElement {
    const opacity = typeof element.style?.opacity === 'number' ? element.style.opacity : 1
    return {
      ...element,
      data: { ...element.data },
      style: {
        ...element.style,
        opacity: opacity * 0.45,
      },
    }
  }

  private createShadowSchema(schema: NovaTemplateChildSchema): NovaTemplateChildSchema {
    return this.rekeySchema(schema, 'shadow')
  }

  private rekeySchema(schema: NovaTemplateChildSchema, segment: string): NovaTemplateChildSchema {
    const next = { ...schema } as NovaTemplateChildSchema & { id?: string; children?: Array<NovaTemplateChildSchema> }
    if (typeof next.id === 'string') next.id = `${next.id}:${segment}`
    if (Array.isArray(next.children)) {
      next.children = next.children.map(child => this.rekeySchema(child, segment))
    }
    return next
  }
}
