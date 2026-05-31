import type { NovaTemplateChildSchema } from '@endge/nova'
import type { ModelerElementCapabilities } from '@/domain/types/elements/element-capability.types'
import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerPluginContext } from '@/domain/types/plugins/plugin.types'
import type { ModelerPort } from '@/domain/types/ports/port.types'

export interface ModelerElementRenderContext extends ModelerPluginContext {
  selected: boolean
}

export interface ModelerElementPortContext extends ModelerPluginContext {}

export interface ModelerElementDefinition<TElement extends ModelerElement = ModelerElement> {
  type: string
  kind: 'node'
  defaults?: Partial<TElement>
  capabilities?: ModelerElementCapabilities
  normalize?(element: TElement): TElement
  render(context: ModelerElementRenderContext, element: TElement): NovaTemplateChildSchema
  getPorts?(context: ModelerElementPortContext, element: TElement): Array<ModelerPort>
}
