import type { NovaTemplateChildSchema } from '@endge/nova'
import type { ModelerElementCapabilities } from '@/domain/types/elements/element-capability.types'
import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/elements/element.types'
import type { ModelerKeyboardShortcut } from '@/domain/types/model/options.types'
import type { ModelerPoint } from '@/domain/types/model/geometry.types'
import type { ModelerPaletteItemDefinition } from '@/domain/types/palette/palette.types'
import type { ModelerPluginContext } from '@/domain/types/plugins/plugin.types'
import type { ModelerPort } from '@/domain/types/ports/port.types'

export interface ModelerElementRenderContext extends ModelerPluginContext {
  selected: boolean
}

export interface ModelerElementPortContext extends ModelerPluginContext {}

export interface ModelerElementHitTestContext extends ModelerPluginContext {}

export interface ModelerElementCreateToolDefinition<TElement extends ModelerElement = ModelerElement> {
  id?: string
  actionId?: string
  shortcutId?: string
  title?: string
  palette?: Partial<ModelerPaletteItemDefinition>
  shortcuts?: Array<ModelerKeyboardShortcut>
  create(input: ModelerElementInput): TElement
}

export interface ModelerElementDefinition<TElement extends ModelerElement = ModelerElement> {
  type: string
  kind: 'node'
  defaults?: Partial<TElement>
  capabilities?: ModelerElementCapabilities
  createTool?: ModelerElementCreateToolDefinition<TElement>
  normalize?(element: TElement): TElement
  render(context: ModelerElementRenderContext, element: TElement): NovaTemplateChildSchema
  getPorts?(context: ModelerElementPortContext, element: TElement): Array<ModelerPort>
  hitTest?(context: ModelerElementHitTestContext, element: TElement, localPoint: ModelerPoint): boolean
}
