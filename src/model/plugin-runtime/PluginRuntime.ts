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
  private readonly _plugins: Array<ModelerPlugin> = []
  private readonly _activePlugins = new Set<ModelerPlugin>()
  private readonly _pluginDisposers = new Map<ModelerPlugin, () => void>()
  private _context: ModelerPluginContext | null = null

  constructor(options: PluginRuntimeOptions = {}) {
    options.plugins?.forEach(plugin => this.use(plugin))
  }

  /**
   * Добавляет plugin в runtime.
   */
  use(plugin: ModelerPlugin): this {
    if (this._plugins.includes(plugin)) {
      return this
    }
    this._plugins.push(plugin)
    if (this._context) {
      this._setupPlugin(plugin)
    }
    return this
  }

  /**
   * Удаляет plugin из runtime.
   */
  unuse(pluginOrId: ModelerPlugin | string): this {
    const plugin = typeof pluginOrId === 'string'
      ? this._plugins.find(item => item.id === pluginOrId)
      : pluginOrId
    if (!plugin) {
      return this
    }
    this._disposePlugin(plugin)
    const index = this._plugins.indexOf(plugin)
    if (index >= 0) {
      this._plugins.splice(index, 1)
    }
    return this
  }

  /**
   * Подключает runtime к Root host-контексту.
   */
  bindRoot(context: ModelerPluginContext): void {
    if (this._context === context) {
      return
    }
    this.unbindRoot()
    this._context = context
    this._plugins.forEach(plugin => this._setupPlugin(plugin))
  }

  /**
   * Отключает runtime от Root host-контекста.
   */
  unbindRoot(): void {
    for (const plugin of [...this._activePlugins]) {
      this._disposePlugin(plugin)
    }
    this._context = null
  }

  /**
   * Возвращает подключенные plugins.
   */
  getPlugins(): ReadonlyArray<ModelerPlugin> {
    return this._plugins
  }

  /**
   * Подключает один plugin к текущему контексту.
   */
  private _setupPlugin(plugin: ModelerPlugin): void {
    if (!this._context || this._activePlugins.has(plugin)) {
      return
    }
    const dispose = plugin.setup(this._context)
    this._activePlugins.add(plugin)
    if (dispose) {
      this._pluginDisposers.set(plugin, dispose)
    }
  }

  /**
   * Отключает один plugin.
   */
  private _disposePlugin(plugin: ModelerPlugin): void {
    if (!this._activePlugins.has(plugin)) {
      return
    }
    this._pluginDisposers.get(plugin)?.()
    this._pluginDisposers.delete(plugin)
    plugin.dispose?.()
    this._activePlugins.delete(plugin)
  }
}

/**
 * Создает runtime Modeler.
 */
export function createPluginRuntime(options: PluginRuntimeOptions = {}): PluginRuntime {
  return new PluginRuntime(options)
}
