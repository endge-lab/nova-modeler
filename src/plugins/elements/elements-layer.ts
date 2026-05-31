import type { NovaTemplateChildSchema } from '@endge/nova'
import { Modeler } from '@/config/schema.config'
import type { ModelerPluginContext } from '@/domain/types/index'
import { MODELER_PORT_RADIUS } from '@/plugins/elements/elements.constants'
import type { ElementsRuntime } from '@/plugins/elements/model/ElementsRuntime'

export class ElementsLayer {
  private disposeLayer: (() => void) | undefined

  constructor(
    private readonly context: ModelerPluginContext,
    private readonly runtime: ElementsRuntime,
  ) {}

  sync(): void {
    const schemas: Array<NovaTemplateChildSchema> = []
    const model = this.context.getModel()
    const selected = new Set(model.selection)
    for (const element of model.elements) {
      const definition = this.context.getElementRegistry().get(element.type)
      if (!definition) continue
      schemas.push(definition.render({ ...this.context, selected: selected.has(element.id) }, element))
      if (!selected.has(element.id)) continue
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
    this.disposeLayer = this.context.layers.reconcile('interaction', 'modeler-elements', schemas)
    this.context.invalidate('render')
  }

  dispose(): void {
    this.disposeLayer?.()
    this.disposeLayer = undefined
  }
}
