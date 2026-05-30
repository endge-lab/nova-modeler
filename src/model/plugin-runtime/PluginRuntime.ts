import type {
  ModelerPlugin,
  ModelerPluginContext,
  ModelerPluginRuntime,
  PluginRuntimeOptions,
} from '@/domain/types/index'

/**
 * Управляет жизненным циклом plugin-расширений вокруг Modeler.Root.
 */
export class PluginRuntime implements ModelerPluginRuntime {
  private readonly plugins: Array<ModelerPlugin> = []
  private readonly activePlugins = new Set<ModelerPlugin>()
  private readonly pluginDisposers = new Map<ModelerPlugin, () => void>()
  private context: ModelerPluginContext | null = null

  constructor(options: PluginRuntimeOptions = {}) {
    options.plugins?.forEach(plugin => this.use(plugin))
  }

  /**
   * Добавляет plugin в runtime.
   */
  use(plugin: ModelerPlugin): this {
    if (this.plugins.includes(plugin)) return this
    this.plugins.push(plugin)
    if (this.context) this.setupPlugin(plugin)
    return this
  }

  /**
   * Удаляет plugin из runtime.
   */
  unuse(pluginOrId: ModelerPlugin | string): this {
    const plugin = typeof pluginOrId === 'string'
      ? this.plugins.find(item => item.id === pluginOrId)
      : pluginOrId
    if (!plugin) return this
    this.disposePlugin(plugin)
    const index = this.plugins.indexOf(plugin)
    if (index >= 0) this.plugins.splice(index, 1)
    return this
  }

  /**
   * Подключает runtime к Root host-контексту.
   */
  bindRoot(context: ModelerPluginContext): void {
    if (this.context === context) return
    this.unbindRoot()
    this.context = context
    this.plugins.forEach(plugin => this.setupPlugin(plugin))
  }

  /**
   * Отключает runtime от Root host-контекста.
   */
  unbindRoot(): void {
    for (const plugin of [...this.activePlugins]) {
      this.disposePlugin(plugin)
    }
    this.context = null
  }

  /**
   * Возвращает подключенные plugins.
   */
  getPlugins(): ReadonlyArray<ModelerPlugin> {
    return this.plugins
  }

  /**
   * Подключает один plugin к текущему контексту.
   */
  private setupPlugin(plugin: ModelerPlugin): void {
    if (!this.context || this.activePlugins.has(plugin)) return
    const dispose = plugin.setup(this.context)
    this.activePlugins.add(plugin)
    if (dispose) this.pluginDisposers.set(plugin, dispose)
  }

  /**
   * Отключает один plugin.
   */
  private disposePlugin(plugin: ModelerPlugin): void {
    if (!this.activePlugins.has(plugin)) return
    this.pluginDisposers.get(plugin)?.()
    this.pluginDisposers.delete(plugin)
    plugin.dispose?.()
    this.activePlugins.delete(plugin)
  }
}

/**
 * Создает runtime Modeler.
 */
export function createPluginRuntime(options: PluginRuntimeOptions = {}): PluginRuntime {
  return new PluginRuntime(options)
}
