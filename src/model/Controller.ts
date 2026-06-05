import { Nova } from '@endge/nova'
import type {
  ControllerHost,
  ControllerOptions,
  ModelerController,
  ModelerCommand,
  ModelerEdgeElement,
  ModelerElement,
  ModelerElementRegistry,
  ModelerGesture,
  ModelerHitTarget,
  ModelerLayout,
  ModelerCommitChange,
  ModelerCommitMeta,
  ModelerModel,
  ModelerModelInput,
  ModelerModelListener,
  ModelerModelSubscribeOptions,
  ModelerOptions,
  ModelerOptionsRef,
  ModelerPlugin,
  ModelerPluginContext,
  ModelerPluginLayer,
  ModelerPluginRuntime,
  ModelerPoint,
  ModelerRect,
  ModelerResizeHandle,
  ModelerStore,
  ModelerStoreKey,
  ModelerViewport,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { normalizeModelerOptions } from '@/config/options.config'
import { clamp } from '@/tools/number'
import { Store } from '@/model/Store'
import { createModelerElementRegistry } from '@/model/ElementRegistry'
import { createPluginRuntime } from '@/model/plugin-runtime/PluginRuntime'
import { ModelerVisibilityRuntime } from '@/model/ModelerVisibilityRuntime'
import { ModelerExternalLabelRuntime } from '@/model/ModelerExternalLabelRuntime'
import { ModelerInvalidationScope } from '@/model/ModelerInvalidationScope'
import { ActionRegistry } from '@/model/registry/ActionRegistry'
import { ElementVariantRegistry } from '@/model/registry/ElementVariantRegistry'
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
import {
  BPMN_PARTICIPANT_TYPE,
  createBpmnParticipantLayout,
  normalizeBpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'

const MODELER_WORLD_BOUNDS_PADDING_RATIO = 0.2
const BPMN_LANE_RESIZE_HANDLE_SCREEN_TOLERANCE = 6
const MODELER_EXTERNAL_LABEL_HANDLE_SIZE = 8
const MODELER_EXTERNAL_LABEL_HANDLES: Array<ModelerResizeHandle> = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

interface ModelerModelListenerEntry {
  listener: ModelerModelListener
  options: ModelerModelSubscribeOptions
}

interface ModelerWorldBoundsCache {
  signature: string
  bounds: ModelerRect
}

export class Controller implements ModelerController {
  readonly store: ModelerStore
  private options: ModelerOptionsRef
  private readonly elementRegistry: ModelerElementRegistry
  private readonly visibilityRuntime: ModelerVisibilityRuntime
  private readonly externalLabelRuntime: ModelerExternalLabelRuntime
  private host: ControllerHost | null = null
  private layout: ModelerLayout
  private committedModel: ModelerModel

  //
  private pluginRuntime: ModelerPluginRuntime
  private pluginLayers: Array<ModelerPluginLayer> = []
  private pluginGestures: Array<ModelerGesture> = []

  //
  private readonly storeValues = new Map<ModelerStoreKey<unknown>, unknown>()
  private readonly modelListeners = new Set<ModelerModelListenerEntry>()
  private readonly invalidation = new ModelerInvalidationScope()
  private worldBoundsCache: ModelerWorldBoundsCache | null = null

  //
  private readonly actions: ActionRegistry
  private readonly elementVariants: ElementVariantRegistry
  private readonly tools: ToolRegistry
  private readonly palette: PaletteRegistry
  private readonly shortcuts: ShortcutRegistry

  private readonly pluginContext: ModelerPluginContext
  private lastConfiguredActiveToolId: string | null | undefined

  //
  private onModelChange?: (model: ModelerModel) => void
  private onSelectionChange?: (selection: Array<string>) => void

  constructor(options: ControllerOptions = {}) {
    this.elementRegistry = options.elementRegistry ?? createModelerElementRegistry()
    this.store = options.store ?? new Store(options.model, { elementRegistry: this.elementRegistry })
    this.visibilityRuntime = new ModelerVisibilityRuntime()
    this.externalLabelRuntime = new ModelerExternalLabelRuntime()
    this.options = normalizeModelerOptions(options.options)
    this.pluginRuntime = options.pluginRuntime ?? createPluginRuntime()
    this.actions = new ActionRegistry(() => this.pluginContext)
    this.elementVariants = new ElementVariantRegistry(() => this.pluginContext)
    this.tools = new ToolRegistry(
      () => this.pluginContext,
      () => this.invalidate('render'),
    )
    this.palette = new PaletteRegistry(() => this.getOptions().palette)
    this.shortcuts = new ShortcutRegistry(
      () => this.getOptions().shortcuts,
      () => this.getOptions().interaction?.selection,
    )
    this.ensureDefaultPlugins(options.plugins)
    this.onModelChange = options.onModelChange
    this.onSelectionChange = options.onSelectionChange
    this.committedModel = this.store.getModel()
    this.layout = this.createLayout()
    this.pluginContext = this.createPluginContext()
  }

  mount(host: ControllerHost): void {
    this.host = host
    Nova.createStore(this.store, {
      app: host.app,
      scope: `modeler.${host.id}`,
    })
    this.worldBoundsCache = null
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
    const previous = this.committedModel
    const next = this.store.setModel(model)
    return this.afterModelCommit(previous, next)
  }

  applyCommand(command: ModelerCommand): ModelerModel {
    if (command.type === 'setViewport') return this.setViewport(command.viewport)
    const previous = this.committedModel
    const next = this.store.apply(command)
    return this.afterModelCommit(previous, next)
  }

  getViewport(): ModelerViewport {
    return this.getModel().viewport
  }

  setViewport(viewport: Partial<ModelerViewport>): ModelerModel {
    const current = this.store.viewport.toJSON()
    const previous = this.committedModel
    this.store.setViewport(this.clampViewport({ ...current, ...viewport }))
    const next = this.getModel()
    return this.afterModelCommit(previous, next, {
      viewportOnly: true,
      changed: ['viewport'],
    })
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
    return point.x >= canvas.x &&
      point.x <= canvas.x + canvas.width &&
      point.y >= canvas.y &&
      point.y <= canvas.y + canvas.height
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

  private afterModelCommit(previous: ModelerModel, next: ModelerModel, meta = this.resolveCommitMeta(previous, next)): ModelerModel {
    const selectedLabel = this.externalLabelRuntime.getSelected()
    if (selectedLabel && !next.selection.includes(selectedLabel.elementId)) this.externalLabelRuntime.clearSelection()
    if (meta.viewportOnly) this.layout = { ...this.layout, viewport: next.viewport }
    else {
      this.worldBoundsCache = null
      this.recomputeLayout()
    }
    this.invalidation.bumpMany(meta.changed)
    this.onModelChange?.(next)
    this.onSelectionChange?.(next.selection)
    for (const entry of this.modelListeners) {
      if (meta.viewportOnly && entry.options.includeViewport === false) continue
      entry.listener(next, meta)
    }
    this.host?.onModelCommit(previous, next, meta)
    this.committedModel = next
    return next
  }

  private resolveCommitMeta(previous: ModelerModel, next: ModelerModel): ModelerCommitMeta {
    const changed: Array<ModelerCommitChange> = []
    if (previous.viewportVersion !== next.viewportVersion) changed.push('viewport')
    if (previous.elementsVersion !== next.elementsVersion) changed.push('data')
    if (previous.bpmnDefinitionsVersion !== next.bpmnDefinitionsVersion) changed.push('bpmnDefinitions')
    if (previous.selectionVersion !== next.selectionVersion) changed.push('selection')
    if (!sameCanvas(previous, next)) changed.push('canvas')
    return {
      changed,
      viewportOnly: changed.length === 1 && changed[0] === 'viewport',
    }
  }

  private setPluginRuntime(pluginRuntime: ModelerPluginRuntime): void {
    if (pluginRuntime === this.pluginRuntime) return
    this.pluginRuntime.unbindRoot()
    this.pluginLayers = []
    this.pluginGestures = []
    this.pluginRuntime = pluginRuntime
    this.ensureDefaultPlugins()
    this.lastConfiguredActiveToolId = undefined
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
      worldBounds: this.resolveCachedWorldBounds(model),
    }
  }

  private resolveCachedWorldBounds(model: ModelerModel): ModelerRect {
    const signature = createWorldBoundsSignature(model)
    if (this.worldBoundsCache?.signature === signature) return this.worldBoundsCache.bounds
    const bounds = this.resolveWorldBounds(model)
    this.worldBoundsCache = { signature, bounds }
    return bounds
  }

  private resolveWorldBounds(model: ModelerModel): ModelerRect {
    let bounds: ModelerRect | null = null
    for (const element of model.elements) {
      const elementBounds = isModelerEdgeElement(element)
        ? this.resolveEdgeWorldBounds(element)
        : { x: element.x, y: element.y, width: element.width, height: element.height }
      const labelBounds = this.resolveExternalLabelWorldBounds(element)
      const fullBounds = labelBounds ? unionRects(elementBounds, labelBounds) : elementBounds
      bounds = bounds ? unionRects(bounds, fullBounds) : fullBounds
    }
    return bounds ? expandRect(bounds, MODELER_WORLD_BOUNDS_PADDING_RATIO) : { ...model.canvas }
  }

  private resolveEdgeWorldBounds(element: ModelerEdgeElement): ModelerRect {
    const points = [element.source.point, ...element.waypoints, element.target.point].filter(
      (point): point is ModelerPoint => Boolean(point),
    )
    if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const point of points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    }
  }

  private resolveExternalLabelWorldBounds(element: ModelerElement): ModelerRect | null {
    const pluginContext = (this as unknown as { pluginContext?: ModelerPluginContext }).pluginContext
    if (!pluginContext) return null
    return this.externalLabelRuntime.resolveBounds(pluginContext, element)
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
      this.pluginLayers = this.pluginLayers.filter((item) => item !== layer)
      this.invalidate('render')
    }
  }

  private addGesture(gesture: ModelerGesture): () => void {
    this.pluginGestures.push(gesture)
    this.pluginGestures.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    return () => {
      this.pluginGestures = this.pluginGestures.filter((item) => item !== gesture)
    }
  }

  private createPluginContext(): ModelerPluginContext {
    return {
      model: {
        get: () => this.getModel(),
        set: (model) => this.setModel(model),
        update: (updater) => this.setModel(updater(this.getModel())),
        subscribe: (listener, options = {}) => {
          const entry: ModelerModelListenerEntry = {
            listener,
            options: { includeViewport: options.includeViewport ?? true },
          }
          this.modelListeners.add(entry)
          return () => this.modelListeners.delete(entry)
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
        inject: (key) => this.storeValues.get(key as ModelerStoreKey<unknown>) as never,
      },
      getModel: () => this.getModel(),
      getLayout: () => this.getLayout(),
      getOptions: () => this.getOptions(),
      getElementRegistry: () => this.getElementRegistry(),
      getViewport: () => this.getViewport(),
      setViewport: (viewport) => this.setViewport(viewport),
      applyCommand: (command) => this.applyCommand(command),
      hitTest: (point) => this.hitTest(point),
      screenToWorld: (point) => this.screenToWorld(point),
      worldToScreen: (point) => this.worldToScreen(point),
      invalidate: (phase) => this.invalidate(phase),
      visibility: this.visibilityRuntime,
      externalLabels: this.externalLabelRuntime,
      layers: {
        add: (layer) => this.addLayer(layer),
        get: (name) => this.requireHost().layers.get(name),
        mount: (name, schema) => this.requireHost().layers.mount(name, schema),
        unmount: (node) => this.requireHost().layers.unmount(node),
        reconcile: (name, ownerId, schema) => this.requireHost().layers.reconcile(name, ownerId, schema),
      },
      gestures: { add: (gesture) => this.addGesture(gesture) },
      actions: {
        register: (definition) => this.actions.register(definition),
        get: (id) => this.actions.get(id),
        getAll: () => this.actions.getAll(),
        run: (id) => this.actions.run(id),
      },
      elementVariants: {
        register: (provider) => this.elementVariants.register(provider),
        getAll: () => this.elementVariants.getAll(),
        getProviders: (element) => this.elementVariants.getProviders(element),
        getProvider: (element) => this.elementVariants.getProvider(element),
        hasProvider: (element) => this.elementVariants.hasProvider(element),
      },
      tools: {
        register: (definition) => this.tools.register(definition),
        get: (id) => this.tools.get(id),
        getAll: () => this.tools.getAll(),
        activate: (id) => this.tools.activate(id),
        deactivate: (id) => this.tools.deactivate(id),
        getActive: () => this.tools.getActive(),
        getActiveId: () => this.tools.getActiveId(),
        createAt: (id, point) => this.tools.createAt(id, point),
        subscribe: (listener) => this.tools.subscribe(listener),
      },
      palette: {
        register: (definition) => this.palette.register(definition),
        get: (id) => this.palette.get(id),
        getAll: () => this.palette.getAll(),
        getItems: () => this.palette.getItems(),
      },
      shortcuts: {
        register: (definition) => this.shortcuts.register(definition),
        get: (id) => this.shortcuts.get(id),
        getAll: () => this.shortcuts.getAll(),
        resolve: (event) => this.shortcuts.resolve(event),
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
    return !sameCanvas(previous, next)
  }

  private ensureDefaultPlugins(plugins: Array<ModelerPlugin> = []): void {
    if (!this.pluginRuntime.getPlugins().some((plugin) => plugin.id === CoreActionsPlugin.ID)) {
      this.pluginRuntime.use(CoreActionsPlugin.create())
    }
    if (!this.pluginRuntime.getPlugins().some((plugin) => plugin.id === MODELER_ELEMENTS_PLUGIN_ID)) {
      this.pluginRuntime.use(ElementsPlugin.create())
    }
    plugins.forEach((plugin) => this.pluginRuntime.use(plugin))
  }

  private activateConfiguredTool(): void {
    const configured = this.options.current.interaction?.tools?.activeToolId
    if (configured === this.lastConfiguredActiveToolId) return
    this.lastConfiguredActiveToolId = configured
    if (configured) this.tools.activate(configured)
    else this.tools.deactivate()
  }

  private hitTestElements(point: ModelerPoint): ModelerHitTarget {
    const elements = this.store.elements.items
    if (elements.length === 0) return { type: 'empty' }
    const selected = this.store.selection.ids.length > 0 ? new Set(this.store.selection.ids) : null
    const externalLabelHandle = this.hitTestExternalLabelResizeHandle(point)
    if (externalLabelHandle) return externalLabelHandle
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition || !selected?.has(element.id)) continue
      const handle = MODEL_ELEMENTS_RUNTIME.handles.createRotateHandle(element, definition)
      if (!handle) continue
      const screen = this.worldToScreen(handle)
      const size = MODELER_ROTATE_HANDLE_SIZE
      if (
        point.x >= screen.x - size / 2 &&
        point.x <= screen.x + size / 2 &&
        point.y >= screen.y - size / 2 &&
        point.y <= screen.y + size / 2
      ) {
        return { type: 'rotate-handle', elementId: element.id }
      }
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition || !selected?.has(element.id)) continue
      for (const handle of MODEL_ELEMENTS_RUNTIME.handles.createResizeHandles(element, definition)) {
        const screen = this.worldToScreen(handle)
        const size = MODELER_RESIZE_HANDLE_SIZE
        if (
          point.x >= screen.x - size / 2 &&
          point.x <= screen.x + size / 2 &&
          point.y >= screen.y - size / 2 &&
          point.y <= screen.y + size / 2
        ) {
          return { type: 'resize-handle', elementId: element.id, handle: handle.handle }
        }
      }
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element || !selected?.has(element.id) || element.type !== BPMN_PARTICIPANT_TYPE) continue
      const target = this.hitTestBpmnParticipantLaneResizeHandle(point, element as BpmnParticipantElement)
      if (target) return target
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition || !selected?.has(element.id)) continue
      if (definition.capabilities?.ports === false) continue
      for (const port of MODEL_ELEMENTS_RUNTIME.ports.createElementPorts(
        element,
        definition.getPorts?.(this.pluginContext, element) ?? [],
      )) {
        const screen = this.worldToScreen(port)
        const radius = port.radius ?? MODELER_PORT_RADIUS
        const dx = point.x - screen.x
        const dy = point.y - screen.y
        if (dx * dx + dy * dy <= radius * radius) {
          return { type: 'port', elementId: element.id, portId: port.id }
        }
      }
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element || !isModelerEdgeElement(element) || !selected?.has(element.id)) continue
      for (const handle of MODEL_ELEMENTS_RUNTIME.edges.createWaypointHandles(element)) {
        const screen = this.worldToScreen(handle)
        const size = handle.size
        if (
          point.x >= screen.x - size / 2 &&
          point.x <= screen.x + size / 2 &&
          point.y >= screen.y - size / 2 &&
          point.y <= screen.y + size / 2
        ) {
          return { type: 'edge-waypoint-handle', elementId: element.id, waypointIndex: handle.waypointIndex }
        }
      }
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element || !isModelerEdgeElement(element) || !selected?.has(element.id)) continue
      const handle = MODEL_ELEMENTS_RUNTIME.edges.createSegmentHandleAtPoint(
        this.pluginContext,
        element,
        this.screenToWorld(point),
      )
      if (handle) return { type: 'edge-segment-handle', elementId: element.id, segmentIndex: handle.segmentIndex }
    }
    const ordered = elements.length > 1 ? [...elements].sort(compareElementsByZIndex) : elements
    const externalLabelTarget = this.hitTestExternalLabels(ordered, point)
    if (externalLabelTarget) return externalLabelTarget
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const element = ordered[index]
      if (!element || !isModelerEdgeElement(element)) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition) continue
      const world = this.screenToWorld(point)
      const contains = definition.hitTest ? definition.hitTest(this.pluginContext, element, world) : false
      if (contains) {
        return { type: 'element', id: element.id }
      }
    }
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const element = ordered[index]
      if (!element || isModelerEdgeElement(element)) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition) continue
      const world = this.screenToWorld(point)
      const local = MODEL_ELEMENTS_RUNTIME.geometry.unrotatePoint(element, world)
      const contains = definition.hitTest
        ? definition.hitTest(this.pluginContext, element, local)
        : local.x >= element.x &&
          local.x <= element.x + element.width &&
          local.y >= element.y &&
          local.y <= element.y + element.height
      if (contains) {
        const partTarget = definition.hitTestPart?.(this.pluginContext, element, local)
        if (partTarget) return partTarget
        return { type: 'element', id: element.id }
      }
    }
    return { type: 'empty' }
  }

  private hitTestExternalLabels(ordered: Array<ModelerElement>, point: ModelerPoint): ModelerHitTarget | null {
    const world = this.screenToWorld(point)
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const element = ordered[index]
      if (!element) continue
      const definition = this.elementRegistry.get(element.type)
      if (!definition?.externalLabel) continue
      if (this.externalLabelRuntime.hitTest(this.pluginContext, element, world)) {
        return { type: 'external-label', elementId: element.id }
      }
    }
    return null
  }

  private hitTestExternalLabelResizeHandle(point: ModelerPoint): ModelerHitTarget | null {
    const selected = this.externalLabelRuntime.getSelected()
    if (!selected) return null
    const element = this.store.elements.items.find((item) => item.id === selected.elementId)
    if (!element) return null
    const layout = this.externalLabelRuntime.resolve(this.pluginContext, element)
    if (!layout) return null
    for (const handle of MODELER_EXTERNAL_LABEL_HANDLES) {
      const handlePoint = resolveExternalLabelHandlePoint(layout.screenRect, handle)
      if (
        point.x >= handlePoint.x - MODELER_EXTERNAL_LABEL_HANDLE_SIZE / 2 &&
        point.x <= handlePoint.x + MODELER_EXTERNAL_LABEL_HANDLE_SIZE / 2 &&
        point.y >= handlePoint.y - MODELER_EXTERNAL_LABEL_HANDLE_SIZE / 2 &&
        point.y <= handlePoint.y + MODELER_EXTERNAL_LABEL_HANDLE_SIZE / 2
      ) {
        return { type: 'external-label-resize-handle', elementId: element.id, handle }
      }
    }
    return null
  }

  private hitTestBpmnParticipantLaneResizeHandle(
    point: ModelerPoint,
    element: BpmnParticipantElement,
  ): ModelerHitTarget | null {
    const layout = createBpmnParticipantLayout(element)
    if (layout.lanes.length <= 1) return null
    const orientation = normalizeBpmnParticipantOrientation(element.data?.orientation)
    for (let index = 0; index < layout.lanes.length - 1; index += 1) {
      const lane = layout.lanes[index]
      if (!lane) continue
      if (orientation === 'vertical') {
        const x = this.worldToScreen({ x: lane.rect.x + lane.rect.width, y: lane.rect.y }).x
        const top = this.worldToScreen({ x: lane.rect.x, y: lane.rect.y }).y
        const bottom = this.worldToScreen({ x: lane.rect.x, y: lane.rect.y + lane.rect.height }).y
        if (
          Math.abs(point.x - x) <= BPMN_LANE_RESIZE_HANDLE_SCREEN_TOLERANCE &&
          point.y >= Math.min(top, bottom) &&
          point.y <= Math.max(top, bottom)
        ) {
          return { type: 'bpmn-lane-resize-handle', elementId: element.id, laneId: lane.id, orientation }
        }
        continue
      }
      const y = this.worldToScreen({ x: lane.rect.x, y: lane.rect.y + lane.rect.height }).y
      const left = this.worldToScreen({ x: lane.rect.x, y: lane.rect.y }).x
      const right = this.worldToScreen({ x: lane.rect.x + lane.rect.width, y: lane.rect.y }).x
      if (
        Math.abs(point.y - y) <= BPMN_LANE_RESIZE_HANDLE_SCREEN_TOLERANCE &&
        point.x >= Math.min(left, right) &&
        point.x <= Math.max(left, right)
      ) {
        return { type: 'bpmn-lane-resize-handle', elementId: element.id, laneId: lane.id, orientation }
      }
    }
    return null
  }
}

function sameCanvas(previous: ModelerModel, next: ModelerModel): boolean {
  return previous.canvas.x === next.canvas.x
    && previous.canvas.y === next.canvas.y
    && previous.canvas.width === next.canvas.width
    && previous.canvas.height === next.canvas.height
    && previous.canvas.gridSize === next.canvas.gridSize
}

function createWorldBoundsSignature(model: ModelerModel): string {
  return [
    model.id,
    model.elementsVersion,
    model.bpmnDefinitionsVersion,
    model.canvas.x,
    model.canvas.y,
    model.canvas.width,
    model.canvas.height,
    model.canvas.gridSize,
  ].join('|')
}

export function createModelerController(options: ControllerOptions = {}): Controller {
  return new Controller(options)
}

function compareElementsByZIndex(a: ModelerElement, b: ModelerElement): number {
  const zIndexDelta = (a.zIndex ?? 0) - (b.zIndex ?? 0)
  if (zIndexDelta !== 0) return zIndexDelta
  return resolveElementHitRank(a) - resolveElementHitRank(b)
}

function resolveElementHitRank(element: ModelerElement): number {
  return element.type === BPMN_PARTICIPANT_TYPE ? -1 : 0
}

function resolveExternalLabelHandlePoint(rect: ModelerRect, handle: ModelerResizeHandle): ModelerPoint {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  if (handle === 'n') return { x: centerX, y: rect.y }
  if (handle === 'e') return { x: rect.x + rect.width, y: centerY }
  if (handle === 's') return { x: centerX, y: rect.y + rect.height }
  if (handle === 'w') return { x: rect.x, y: centerY }
  return {
    x: handle.includes('e') ? rect.x + rect.width : rect.x,
    y: handle.includes('s') ? rect.y + rect.height : rect.y,
  }
}

function unionRects(a: ModelerRect, b: ModelerRect): ModelerRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  }
}

function expandRect(rect: ModelerRect, ratio: number): ModelerRect {
  const paddingX = rect.width * ratio
  const paddingY = rect.height * ratio
  return {
    x: rect.x - paddingX,
    y: rect.y - paddingY,
    width: rect.width + paddingX * 2,
    height: rect.height + paddingY * 2,
  }
}
