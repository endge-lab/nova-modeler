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
  private disposeLayer: (() => void) | undefined
  private readonly disposeShadow: () => void
  private readonly disposePreview: () => void

  constructor(
    private readonly context: ModelerPluginContext,
    private readonly runtime: ElementsRuntime,
  ) {
    this.disposeShadow = this.runtime.dragShadow.subscribe(() => this.sync())
    this.disposePreview = this.runtime.edgePreview.subscribe(() => this.sync())
  }

  sync(): void {
    const schemas: Array<NovaTemplateChildSchema> = []
    const model = this.context.getModel()
    const selected = new Set(model.selection)
    for (const element of this.runtime.dragShadow.getElements()) {
      const definition = this.context.getElementRegistry().get(element.type)
      if (!definition) continue
      schemas.push(this.createShadowSchema(definition.render({
        ...this.context,
        selected: false,
      }, this.createShadowElement(element))))
    }
    const edges = model.elements.filter(element => this.runtime.edges.isEdge(element))
    const nodes = model.elements.filter(element => !this.runtime.edges.isEdge(element))
    for (const element of edges) {
      this.appendElementSchema(schemas, element, selected)
    }
    for (const element of nodes) {
      this.appendElementSchema(schemas, element, selected)
    }
    const preview = this.runtime.edgePreview.get()
    if (preview) {
      const definition = this.context.getElementRegistry().get(preview.type)
      if (definition) {
        schemas.push(definition.render({ ...this.context, selected: false }, preview))
        const schema = schemas[schemas.length - 1] as NovaTemplateChildSchema & { props?: Record<string, unknown> }
        schema.id = `${preview.id}:preview`
        schema.props = { ...(schema.props ?? {}), preview: true }
      }
    }
    this.disposeLayer = this.context.layers.reconcile('interaction', 'modeler-elements', schemas)
    this.context.invalidate('render')
  }

  private appendElementSchema(
    schemas: Array<NovaTemplateChildSchema>,
    element: ModelerElement,
    selected: Set<string>,
  ): void {
      const definition = this.context.getElementRegistry().get(element.type)
      if (!definition) return
      schemas.push(definition.render({ ...this.context, selected: selected.has(element.id) }, element))
      if (!selected.has(element.id)) return
      if (isModelerEdgeElement(element)) {
        for (const handle of this.runtime.edges.createWaypointHandles(element as ModelerEdgeElement)) {
          schemas.push({
            type: Modeler.EdgeWaypointHandleView,
            id: `${element.id}:waypoint:${handle.waypointIndex}`,
            props: { handle, viewport: this.context.getViewport() },
          })
        }
        return
      }
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
    this.disposeLayer?.()
    this.disposeLayer = undefined
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
