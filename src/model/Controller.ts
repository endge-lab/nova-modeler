import type {
  ControllerHost,
  ControllerOptions,
  ModelerController,
  ModelerCommand,
  ModelerElement,
  ModelerElementRegistry,
  ModelerGesture,
  ModelerHitTarget,
  ModelerLayout,
  ModelerModel,
  ModelerModelInput,
  ModelerOptions,
  ModelerOptionsRef,
  ModelerPlugin,
  ModelerPluginContext,
  ModelerPluginLayer,
  ModelerPluginRuntime,
  ModelerPoint,
  ModelerStore,
  ModelerStoreKey,
  ModelerViewport,
} from '@/domain/types/index'
import { Nova } from '@endge/nova'
import { normalizeModelerOptions } from '@/config/options.config'
import { clamp } from '@/tools/number'
import { Store } from '@/model/Store'
import { createModelerElementRegistry } from '@/model/ElementRegistry'
import { createPluginRuntime } from '@/model/plugin-runtime/PluginRuntime'
import { ActionRegistry } from '@/model/registry/ActionRegistry'
import { PaletteRegistry } from '@/model/registry/PaletteRegistry'
import { ShortcutRegistry } from '@/model/registry/ShortcutRegistry'
import { ToolRegistry } from '@/model/registry/ToolRegistry'
import {
  MODELER_PORT_RADIUS,
  MODELER_ROTATE_HANDLE_SIZE,
  MODELER_RESIZE_HANDLE_SIZE,
  MODELER_ELEMENTS_PLUGIN_ID,
} from '@/plugins/elements/elements.constants'
import { ElementsPlugin } from '@/plugins/elements/elements-plugin'
import { CoreActionsPlugin } from '@/plugins/core/core-actions-plugin'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'

export class Controller implements ModelerController {
  readonly store: ModelerStore
  private options: ModelerOptionsRef
  private readonly elementRegistry: ModelerElementRegistry
  private host: ControllerHost | null = null
  private layout: ModelerLayout
  private pluginRuntime: ModelerPluginRuntime
  private readonly storeValues = new Map<ModelerStoreKey<unknown>, unknown>()
  private readonly modelListeners = new Set<(model: ModelerModel) => void>()
  private pluginLayers: Array<ModelerPluginLayer> = []
  private pluginGestures: Array<ModelerGesture> = []
  private readonly actions: ActionRegistry
  private readonly tools: ToolRegistry
  private readonly palette: PaletteRegistry
  private readonly shortcuts: ShortcutRegistry
  private readonly pluginContext: ModelerPluginContext
  private onModelChange?: (model: ModelerModel) => void
  private onSelectionChange?: (selection: Array<string>) => void

  constructor(options: ControllerOptions = {}) {
    this.elementRegistry = options.elementRegistry ?? createModelerElementRegistry()
    this.store = options.store ?? new Store(options.model, { elementRegistry: this.elementRegistry })
    this.options = normalizeModelerOptions(options.options)
    this.pluginRuntime = options.pluginRuntime ?? createPluginRuntime()
    this.actions = new ActionRegistry(() => this.pluginContext)
    this.tools = new ToolRegistry(() => this.pluginContext, () => this.invalidate('render'))
    this.palette = new PaletteRegistry(() => this.getOptions().palette)
    this.shortcuts = new ShortcutRegistry(
      () => this.getOptions().shortcuts,
      () => this.getOptions().interaction?.selection,
    )
    this.ensureDefaultPlugins(options.plugins)
    this.onModelChange = options.onModelChange
    this.onSelectionChange = options.onSelectionChange
    this.layout = this.createLayout()
    this.pluginContext = this.createPluginContext()
  }

  mount(host: ControllerHost): void {
    this.host = host
    Nova.createStore(this.store, {
      app: host.app,
      scope: `modeler.${host.id}`,
    })
    this.recomputeLayout()
    this.pluginRuntime.bindRoot(this.pluginContext)
    this.activateConfiguredTool()
  }

  unmount(): void {
    this.pluginRuntime.unbindRoot()
    this.pluginLayers = []
    this.pluginGestures = []
    this.host = null
  }

  configure(options: ControllerOptions): void {
    if (options.options) this.options = normalizeModelerOptions(options.options)
    this.onModelChange = options.onModelChange ?? this.onModelChange
    this.onSelectionChange = options.onSelectionChange ?? this.onSelectionChange
    if (options.pluginRuntime || options.plugins) {
      this.setPluginRuntime(options.pluginRuntime ?? createPluginRuntime({ plugins: options.plugins }))
    }
    if (options.model) this.setModel(options.model)
    else {
      this.activateConfiguredTool()
      this.recomputeLayout()
      this.invalidate()
    }
  }

  resize(width: number, height: number): void {
    if (!this.host) return
    if (this.host.width === width && this.host.height === height) return
    this.host.width = width
    this.host.height = height
    this.recomputeLayout()
    this.invalidate()
  }

  use(plugin: ModelerPlugin): this {
    this.pluginRuntime.use(plugin)
    return this
  }

  unuse(pluginOrId: ModelerPlugin | string): this {
    this.pluginRuntime.unuse(pluginOrId)
    return this
  }

  getModel(): ModelerModel {
    return this.store.getModel()
  }

  setModel(model: ModelerModel | ModelerModelInput): ModelerModel {
    const previous = this.getModel()
    const next = this.store.setModel(model)
    return this.afterModelCommit(previous, next)
  }

  applyCommand(command: ModelerCommand): ModelerModel {
    if (command.type === 'setViewport') return this.setViewport(command.viewport)
    const previous = this.getModel()
    const next = this.store.apply(command)
    return this.afterModelCommit(previous, next)
  }

  getViewport(): ModelerViewport {
    return this.getModel().viewport
  }

  setViewport(viewport: Partial<ModelerViewport>): ModelerModel {
    const current = this.getModel().viewport
    const previous = this.getModel()
    this.store.setViewport(this.clampViewport({ ...current, ...viewport }))
    const next = this.getModel()
    return this.afterModelCommit(previous, next)
  }

  fitView(): ModelerViewport {
    const viewport = this.fitViewportToWorld()
    this.setViewport(viewport)
    return viewport
  }

  getLayout(): ModelerLayout {
    return this.layout
  }

  getOptions(): ModelerOptions {
    return this.options.current
  }

  getElementRegistry(): ModelerElementRegistry {
    return this.elementRegistry
  }

  getPluginContext(): ModelerPluginContext {
    return this.pluginContext
  }

  getPluginLayers(): ReadonlyArray<ModelerPluginLayer> {
    return this.pluginLayers
  }

  getGestures(): ReadonlyArray<ModelerGesture> {
    return this.pluginGestures
  }

  hitTest(point: ModelerPoint): ModelerHitTarget {
    const elementTarget = this.hitTestElements(point)
    if (elementTarget.type !== 'empty') return elementTarget
    const canvas = this.layout.canvas
    return point.x >= canvas.x
      && point.x <= canvas.x + canvas.width
      && point.y >= canvas.y
      && point.y <= canvas.y + canvas.height
      ? { type: 'canvas' }
      : { type: 'empty' }
  }

  screenToWorld(point: ModelerPoint): ModelerPoint {
    return {
      x: (point.x - this.layout.viewport.x) / this.layout.viewport.scale,
      y: (point.y - this.layout.viewport.y) / this.layout.viewport.scale,
    }
  }

  worldToScreen(point: ModelerPoint): ModelerPoint {
    return {
      x: point.x * this.layout.viewport.scale + this.layout.viewport.x,
      y: point.y * this.layout.viewport.scale + this.layout.viewport.y,
    }
  }

  invalidate(phase: 'update' | 'render' | 'both' = 'both'): void {
    this.host?.invalidate(phase)
  }

  private afterModelCommit(previous: ModelerModel, next: ModelerModel): ModelerModel {
    this.recomputeLayout()
    this.onModelChange?.(next)
    this.onSelectionChange?.(next.selection)
    for (const listener of this.modelListeners) listener(next)
    this.host?.onModelCommit(previous, next)
    return next
  }

  private setPluginRuntime(pluginRuntime: ModelerPluginRuntime): void {
    if (pluginRuntime === this.pluginRuntime) return
    this.pluginRuntime.unbindRoot()
    this.pluginLayers = []
    this.pluginGestures = []
    this.pluginRuntime = pluginRuntime
    this.ensureDefaultPlugins()
    if (this.host) this.pluginRuntime.bindRoot(this.pluginContext)
  }

  private recomputeLayout(): void {
    this.layout = this.createLayout()
  }

  private createLayout(): ModelerLayout {
    const model = this.getModel()
    return {
      width: this.host?.width ?? 0,
      height: this.host?.height ?? 0,
      canvas: { x: 0, y: 0, width: this.host?.width ?? 0, height: this.host?.height ?? 0 },
      viewport: model.viewport,
      worldBounds: { ...model.canvas },
    }
  }

  private clampViewport(viewport: ModelerViewport): ModelerViewport {
    const opts = this.options.current.viewport
    const scale = clamp(viewport.scale, opts?.minZoom ?? 0.1, opts?.maxZoom ?? 3)
    const layout = { ...this.layout, viewport: { ...viewport, scale } }
    const minX = layout.canvas.width - (layout.worldBounds.x + layout.worldBounds.width) * scale
    const maxX = -layout.worldBounds.x * scale
    const minY = layout.canvas.height - (layout.worldBounds.y + layout.worldBounds.height) * scale
    const maxY = -layout.worldBounds.y * scale
    return {
      x: clamp(viewport.x, Math.min(minX, maxX), Math.max(minX, maxX)),
      y: clamp(viewport.y, Math.min(minY, maxY), Math.max(minY, maxY)),
      scale,
    }
  }

  private fitViewportToWorld(padding = 80): ModelerViewport {
    const scale = Math.min(
      this.layout.canvas.width / (this.layout.worldBounds.width + padding * 2),
      this.layout.canvas.height / (this.layout.worldBounds.height + padding * 2),
    )
    return this.clampViewport({
      x: this.layout.canvas.width / 2 - (this.layout.worldBounds.x + this.layout.worldBounds.width / 2) * scale,
      y: this.layout.canvas.height / 2 - (this.layout.worldBounds.y + this.layout.worldBounds.height / 2) * scale,
      scale,
    })
  }

  private addLayer(layer: ModelerPluginLayer): () => void {
    this.pluginLayers.push(layer)
    this.pluginLayers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    this.invalidate('render')
    return () => {
      this.pluginLayers = this.pluginLayers.filter(item => item !== layer)
      this.invalidate('render')
    }
  }

  private addGesture(gesture: ModelerGesture): () => void {
    this.pluginGestures.push(gesture)
    this.pluginGestures.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    return () => {
      this.pluginGestures = this.pluginGestures.filter(item => item !== gesture)
    }
  }

  private createPluginContext(): ModelerPluginContext {
    return {
      model: {
        get: () => this.getModel(),
        set: model => this.setModel(model),
        update: updater => this.setModel(updater(this.getModel())),
        subscribe: listener => {
          this.modelListeners.add(listener)
          return () => this.modelListeners.delete(listener)
        },
      },
      store: {
        provide: (key, value) => {
          this.storeValues.set(key as ModelerStoreKey<unknown>, value)
          return () => {
            if (this.storeValues.get(key as ModelerStoreKey<unknown>) === value) {
              this.storeValues.delete(key as ModelerStoreKey<unknown>)
            }
          }
        },
        inject: key => this.storeValues.get(key as ModelerStoreKey<unknown>) as never,
      },
      getModel: () => this.getModel(),
      getLayout: () => this.getLayout(),
      getOptions: () => this.getOptions(),
      getElementRegistry: () => this.getElementRegistry(),
      getViewport: () => this.getViewport(),
      setViewport: viewport => this.setViewport(viewport),
      applyCommand: command => this.applyCommand(command),
      hitTest: point => this.hitTest(point),
      screenToWorld: point => this.screenToWorld(point),
      worldToScreen: point => this.worldToScreen(point),
      invalidate: phase => this.invalidate(phase),
      layers: {
        add: layer => this.addLayer(layer),
        get: name => this.requireHost().layers.get(name),
        mount: (name, schema) => this.requireHost().layers.mount(name, schema),
        unmount: node => this.requireHost().layers.unmount(node),
        reconcile: (name, ownerId, schema) => this.requireHost().layers.reconcile(name, ownerId, schema),
      },
      gestures: { add: gesture => this.addGesture(gesture) },
      actions: {
        register: definition => this.actions.register(definition),
        get: id => this.actions.get(id),
        getAll: () => this.actions.getAll(),
        run: id => this.actions.run(id),
      },
      tools: {
        register: definition => this.tools.register(definition),
        get: id => this.tools.get(id),
        getAll: () => this.tools.getAll(),
        activate: id => this.tools.activate(id),
        deactivate: id => this.tools.deactivate(id),
        getActive: () => this.tools.getActive(),
        getActiveId: () => this.tools.getActiveId(),
        createAt: (id, point) => this.tools.createAt(id, point),
      },
      palette: {
        register: definition => this.palette.register(definition),
        get: id => this.palette.get(id),
        getAll: () => this.palette.getAll(),
        getItems: () => this.palette.getItems(),
      },
      shortcuts: {
        register: definition => this.shortcuts.register(definition),
        get: id => this.shortcuts.get(id),
        getAll: () => this.shortcuts.getAll(),
        resolve: event => this.shortcuts.resolve(event),
      },
    }
  }

  private requireHost(): ControllerHost {
    if (!this.host) throw new Error('[Controller] Modeler host is not mounted.')
    return this.host
  }

  static shouldSyncLayerTemplates(previous: ModelerModel, next: ModelerModel): boolean {
    if (previous.id !== next.id) return true
    if (previous.selectionVersion !== next.selectionVersion) return true
    return previous.canvas.x !== next.canvas.x
      || previous.canvas.y !== next.canvas.y
      || previous.canvas.width !== next.canvas.width
      || previous.canvas.height !== next.canvas.height
      || previous.canvas.gridSize !== next.canvas.gridSize
  }

  private ensureDefaultPlugins(plugins: Array<ModelerPlugin> = []): void {
    if (!this.pluginRuntime.getPlugins().some(plugin => plugin.id === CoreActionsPlugin.ID)) {
      this.pluginRuntime.use(CoreActionsPlugin.create())
    }
    if (!this.pluginRuntime.getPlugins().some(plugin => plugin.id === MODELER_ELEMENTS_PLUGIN_ID)) {
      this.pluginRuntime.use(ElementsPlugin.create())
    }
    plugins.forEach(plugin => this.pluginRuntime.use(plugin))
  }

  private activateConfiguredTool(): void {
    const configured = this.options.current.interaction?.tools?.activeToolId
    if (configured) this.tools.activate(configured)
    else this.tools.deactivate()
  }

  private hitTestElements(point: ModelerPoint): ModelerHitTarget {
    const model = this.getModel()
    const selected = new Set(model.selection)
    for (let index = model.elements.length - 1; index >= 0; index -= 1) {
      const element = model.elements[index]
      if (!element) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition || !selected.has(element.id)) continue
      const handle = MODEL_ELEMENTS_RUNTIME.handles.createRotateHandle(element, definition)
      if (!handle) continue
      const screen = this.worldToScreen(handle)
      const size = MODELER_ROTATE_HANDLE_SIZE
      if (point.x >= screen.x - size / 2 && point.x <= screen.x + size / 2
        && point.y >= screen.y - size / 2 && point.y <= screen.y + size / 2) {
        return { type: 'rotate-handle', elementId: element.id }
      }
    }
    for (let index = model.elements.length - 1; index >= 0; index -= 1) {
      const element = model.elements[index]
      if (!element) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition || !selected.has(element.id)) continue
      for (const handle of MODEL_ELEMENTS_RUNTIME.handles.createResizeHandles(element, definition)) {
        const screen = this.worldToScreen(handle)
        const size = MODELER_RESIZE_HANDLE_SIZE
        if (point.x >= screen.x - size / 2 && point.x <= screen.x + size / 2
          && point.y >= screen.y - size / 2 && point.y <= screen.y + size / 2) {
          return { type: 'resize-handle', elementId: element.id, handle: handle.handle }
        }
      }
    }
    for (let index = model.elements.length - 1; index >= 0; index -= 1) {
      const element = model.elements[index]
      if (!element) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition || !selected.has(element.id)) continue
      for (const port of MODEL_ELEMENTS_RUNTIME.ports.createElementPorts(element, definition.getPorts?.(this.pluginContext, element) ?? [])) {
        const screen = this.worldToScreen(port)
        const radius = port.radius ?? MODELER_PORT_RADIUS
        const dx = point.x - screen.x
        const dy = point.y - screen.y
        if (dx * dx + dy * dy <= radius * radius) {
          return { type: 'port', elementId: element.id, portId: port.id }
        }
      }
    }
    const ordered = [...model.elements].sort(compareElementsByZIndex)
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const element = ordered[index]
      if (!element) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition) continue
      const world = this.screenToWorld(point)
      const local = MODEL_ELEMENTS_RUNTIME.geometry.unrotatePoint(element, world)
      const contains = definition.hitTest
        ? definition.hitTest(this.pluginContext, element, local)
        : local.x >= element.x && local.x <= element.x + element.width
          && local.y >= element.y && local.y <= element.y + element.height
      if (contains) {
        return { type: 'element', id: element.id }
      }
    }
    return { type: 'empty' }
  }
}

export function createModelerController(options: ControllerOptions = {}): Controller {
  return new Controller(options)
}

function compareElementsByZIndex(a: ModelerElement, b: ModelerElement): number {
  return (a.zIndex ?? 0) - (b.zIndex ?? 0)
}
