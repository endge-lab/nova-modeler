import type { NovaAssetRef } from '@endge/nova'
import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerPluginContext } from '@/domain/types/plugins/plugin.types'

export type ModelerElementVariantControlKind = 'choice' | 'list' | 'input' | 'toggle' | 'iconToggle'

export interface ModelerElementVariantDraft extends Record<string, unknown> {}

export interface ModelerElementVariantOption {
  id: string
  title: string
  description?: string
  icon?: string | NovaAssetRef<'icon' | 'image'>
  selected?: boolean
  disabled?: boolean
  data?: Record<string, unknown>
}

export interface ModelerElementVariantControl {
  id: string
  kind: ModelerElementVariantControlKind
  title?: string
  value?: unknown
  placeholder?: string
  options: Array<ModelerElementVariantOption>
}

export interface ModelerElementVariantDescriptor {
  title?: string
  headerControls?: Array<ModelerElementVariantControl>
  controls: Array<ModelerElementVariantControl>
}

export interface ModelerElementVariantApplyContext<TElement extends ModelerElement = ModelerElement> {
  context: ModelerPluginContext
  element: TElement
  draft: ModelerElementVariantDraft
  control: ModelerElementVariantControl
  option: ModelerElementVariantOption
}

export interface ModelerElementVariantProvider<TElement extends ModelerElement = ModelerElement> {
  id: string
  priority?: number
  matches(context: ModelerPluginContext, element: ModelerElement): element is TElement
  createDraft?(context: ModelerPluginContext, element: TElement): ModelerElementVariantDraft
  getDescriptor(
    context: ModelerPluginContext,
    element: TElement,
    draft: ModelerElementVariantDraft,
  ): ModelerElementVariantDescriptor
  updateDraft?(
    context: ModelerPluginContext,
    element: TElement,
    draft: ModelerElementVariantDraft,
    control: ModelerElementVariantControl,
    option: ModelerElementVariantOption,
  ): ModelerElementVariantDraft
  apply(context: ModelerElementVariantApplyContext<TElement>): void
}

export interface ModelerElementVariantRegistryApi {
  register(provider: ModelerElementVariantProvider): () => void
  getAll(): ReadonlyArray<ModelerElementVariantProvider>
  getProviders(element: ModelerElement): Array<ModelerElementVariantProvider>
  getProvider(element: ModelerElement): ModelerElementVariantProvider | undefined
  hasProvider(element: ModelerElement): boolean
}
