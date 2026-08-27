import type {
  ModelerElement,
  ModelerElementVariantProvider,
  ModelerPluginContext,
} from '@/domain/types'

export class ElementVariantRegistry {
  private readonly _providers = new Map<string, ModelerElementVariantProvider>()

  constructor(private readonly _getContext: () => ModelerPluginContext) {}

  register(provider: ModelerElementVariantProvider): () => void {
    this._providers.set(provider.id, provider)
    return () => {
      if (this._providers.get(provider.id) === provider) {
        this._providers.delete(provider.id)
      }
    }
  }

  getAll(): ReadonlyArray<ModelerElementVariantProvider> {
    return [...this._providers.values()].sort(compareProviders)
  }

  getProviders(element: ModelerElement): Array<ModelerElementVariantProvider> {
    const context = this._getContext()
    return this.getAll().filter(provider => provider.matches(context, element))
  }

  getProvider(element: ModelerElement): ModelerElementVariantProvider | undefined {
    return this.getProviders(element)[0]
  }

  hasProvider(element: ModelerElement): boolean {
    return Boolean(this.getProvider(element))
  }
}

function compareProviders(a: ModelerElementVariantProvider, b: ModelerElementVariantProvider): number {
  return (b.priority ?? 0) - (a.priority ?? 0)
}
