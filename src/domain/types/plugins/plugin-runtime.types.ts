import type {
  ModelerPlugin,
  ModelerPluginContext,
} from '@/domain/types/plugins/plugin.types'

export interface PluginRuntimeOptions {
  plugins?: Array<ModelerPlugin>
}

export interface ModelerPluginRuntime {
  use(plugin: ModelerPlugin): this
  unuse(pluginOrId: ModelerPlugin | string): this
  bindRoot(context: ModelerPluginContext): void
  unbindRoot(): void
  getPlugins(): ReadonlyArray<ModelerPlugin>
}
