import type {
  ControllerHost,
  ControllerOptions,
  ModelerCommand,
  ModelerCommitChange,
  ModelerCommitMeta,
  ModelerController,
  ModelerEdgeElement,
  ModelerElement,
  ModelerElementRegistry,
  ModelerGesture,
  ModelerHitTarget,
  ModelerLayout,
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
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import { Nova } from '@endge/nova'
import { normalizeModelerOptions } from '@/config/options.config'
import { isModelerEdgeElement } from '@/domain/types/index'
import {
  BPMN_PARTICIPANT_TYPE,
  createBpmnParticipantLayout,
  normalizeBpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import { createModelerElementRegistry } from '@/model/ElementRegistry'
import { ModelerExternalLabelRuntime } from '@/model/ModelerExternalLabelRuntime'
import { ModelerInvalidationScope } from '@/model/ModelerInvalidationScope'
import { ModelerVisibilityRuntime } from '@/model/ModelerVisibilityRuntime'
import { createPluginRuntime } from '@/model/plugin-runtime/PluginRuntime'
import { ActionRegistry } from '@/model/registry/ActionRegistry'
import { ElementVariantRegistry } from '@/model/registry/ElementVariantRegistry'
import { PaletteRegistry } from '@/model/registry/PaletteRegistry'
import { ShortcutRegistry } from '@/model/registry/ShortcutRegistry'
import { ToolRegistry } from '@/model/registry/ToolRegistry'
import { Store } from '@/model/Store'
import { CoreActionsPlugin } from '@/plugins/core/core-actions-plugin'
import { ElementsPlugin } from '@/plugins/elements/elements-plugin'
import {
  MODELER_ELEMENTS_PLUGIN_ID,
  MODELER_PORT_RADIUS,
  MODELER_RESIZE_HANDLE_SIZE,
  MODELER_ROTATE_HANDLE_SIZE,
} from '@/plugins/elements/elements.constants'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'
import { clamp } from '@/tools/number'

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
  private _options: ModelerOptionsRef
  private readonly _elementRegistry: ModelerElementRegistry
  private readonly _visibilityRuntime: ModelerVisibilityRuntime
  private readonly _externalLabelRuntime: ModelerExternalLabelRuntime
  private _host: ControllerHost | null = null
  private _layout: ModelerLayout
  private _committedModel: ModelerModel

  //
  private _pluginRuntime: ModelerPluginRuntime
  private _pluginLayers: Array<ModelerPluginLayer> = []
  private _pluginGestures: Array<ModelerGesture> = []

  //
  private readonly _storeValues = new Map<ModelerStoreKey<unknown>, unknown>()
  private readonly _modelListeners = new Set<ModelerModelListenerEntry>()
  private readonly _invalidation = new ModelerInvalidationScope()
  private _worldBoundsCache: ModelerWorldBoundsCache | null = null

  //
  private readonly _actions: ActionRegistry
  private readonly _elementVariants: ElementVariantRegistry
  private readonly _tools: ToolRegistry
  private readonly _palette: PaletteRegistry
  private readonly _shortcuts: ShortcutRegistry

  private readonly _pluginContext: ModelerPluginContext
  private _lastConfiguredActiveToolId: string | null | undefined

  //
  private _onModelChange?: (model: ModelerModel) => void
  private _onSelectionChange?: (selection: Array<string>) => void

  constructor(options: ControllerOptions = {}) {
    this._elementRegistry = options.elementRegistry ?? createModelerElementRegistry()
    this.store = options.store ?? new Store(options.model, { elementRegistry: this._elementRegistry })
    this._visibilityRuntime = new ModelerVisibilityRuntime()
    this._externalLabelRuntime = new ModelerExternalLabelRuntime()
    this._options = normalizeModelerOptions(options.options)
    this._pluginRuntime = options.pluginRuntime ?? createPluginRuntime()
    this._actions = new ActionRegistry(() => this._pluginContext)
    this._elementVariants = new ElementVariantRegistry(() => this._pluginContext)
    this._tools = new ToolRegistry(
      () => this._pluginContext,
      () => this.invalidate('render'),
    )
    this._palette = new PaletteRegistry(() => this.getOptions().palette)
    this._shortcuts = new ShortcutRegistry(
      () => this.getOptions().shortcuts,
      () => this.getOptions().interaction?.selection,
    )
    this._ensureDefaultPlugins(options.plugins)
    this._onModelChange = options.onModelChange
    this._onSelectionChange = options.onSelectionChange
    this._committedModel = this.store.getModel()
    this._layout = this._createLayout()
    this._pluginContext = this._createPluginContext()
  }

  mount(host: ControllerHost): void {
    this._host = host
    Nova.createStore(this.store, {
      app: host.app,
      scope: `modeler.${host.id}`,
    })
    this._worldBoundsCache = null
    this._recomputeLayout()
    this._pluginRuntime.bindRoot(this._pluginContext)
    this._activateConfiguredTool()
  }

  unmount(): void {
    this._pluginRuntime.unbindRoot()
    this._pluginLayers = []
    this._pluginGestures = []
    this._host = null
  }

  configure(options: ControllerOptions): void {
    if (options.options) {
      this._options = normalizeModelerOptions(options.options)
    }
    this._onModelChange = options.onModelChange ?? this._onModelChange
    this._onSelectionChange = options.onSelectionChange ?? this._onSelectionChange
    if (options.pluginRuntime || options.plugins) {
      this._setPluginRuntime(options.pluginRuntime ?? createPluginRuntime({ plugins: options.plugins }))
    }
    if (options.model) {
      this.setModel(options.model)
    }
    else {
      this._activateConfiguredTool()
      this._recomputeLayout()
      this.invalidate()
    }
  }

  resize(width: number, height: number): void {
    if (!this._host) {
      return
    }
    if (this._host.width === width && this._host.height === height) {
      return
    }
    this._host.width = width
    this._host.height = height
    this._recomputeLayout()
    this.invalidate()
  }

  use(plugin: ModelerPlugin): this {
    this._pluginRuntime.use(plugin)
    return this
  }

  unuse(pluginOrId: ModelerPlugin | string): this {
    this._pluginRuntime.unuse(pluginOrId)
    return this
  }

  getModel(): ModelerModel {
    return this.store.getModel()
  }

  setModel(model: ModelerModel | ModelerModelInput): ModelerModel {
    const previous = this._committedModel
    const next = this.store.setModel(model)
    return this._afterModelCommit(previous, next)
  }

  applyCommand(command: ModelerCommand): ModelerModel {
    if (command.type === 'setViewport') {
      return this.setViewport(command.viewport)
    }
    const previous = this._committedModel
    const next = this.store.apply(command)
    return this._afterModelCommit(previous, next)
  }

  getViewport(): ModelerViewport {
    return this.getModel().viewport
  }

  setViewport(viewport: Partial<ModelerViewport>): ModelerModel {
    const current = this.store.viewport.toJSON()
    const previous = this._committedModel
    this.store.setViewport(this._clampViewport({ ...current, ...viewport }))
    const next = this.getModel()
    return this._afterModelCommit(previous, next, {
      viewportOnly: true,
      changed: ['viewport'],
    })
  }

  fitView(): ModelerViewport {
    const viewport = this._fitViewportToWorld()
    this.setViewport(viewport)
    return viewport
  }

  getLayout(): ModelerLayout {
    return this._layout
  }

  getOptions(): ModelerOptions {
    return this._options.current
  }

  getElementRegistry(): ModelerElementRegistry {
    return this._elementRegistry
  }

  getPluginContext(): ModelerPluginContext {
    return this._pluginContext
  }

  getPluginLayers(): ReadonlyArray<ModelerPluginLayer> {
    return this._pluginLayers
  }

  getGestures(): ReadonlyArray<ModelerGesture> {
    return this._pluginGestures
  }

  hitTest(point: ModelerPoint): ModelerHitTarget {
    const elementTarget = this._hitTestElements(point)
    if (elementTarget.type !== 'empty') {
      return elementTarget
    }
    const canvas = this._layout.canvas
    return point.x >= canvas.x
      && point.x <= canvas.x + canvas.width
      && point.y >= canvas.y
      && point.y <= canvas.y + canvas.height
      ? { type: 'canvas' }
      : { type: 'empty' }
  }

  screenToWorld(point: ModelerPoint): ModelerPoint {
    return {
      x: (point.x - this._layout.viewport.x) / this._layout.viewport.scale,
      y: (point.y - this._layout.viewport.y) / this._layout.viewport.scale,
    }
  }

  worldToScreen(point: ModelerPoint): ModelerPoint {
    return {
      x: point.x * this._layout.viewport.scale + this._layout.viewport.x,
      y: point.y * this._layout.viewport.scale + this._layout.viewport.y,
    }
  }

  invalidate(phase: 'update' | 'render' | 'both' = 'both'): void {
    this._host?.invalidate(phase)
  }

  private _afterModelCommit(previous: ModelerModel, next: ModelerModel, meta = this._resolveCommitMeta(previous, next)): ModelerModel {
    const selectedLabel = this._externalLabelRuntime.getSelected()
    if (selectedLabel && !next.selection.includes(selectedLabel.elementId)) {
      this._externalLabelRuntime.clearSelection()
    }
    if (meta.viewportOnly) {
      this._layout = { ...this._layout, viewport: next.viewport }
    }
    else {
      this._worldBoundsCache = null
      this._recomputeLayout()
    }
    this._invalidation.bumpMany(meta.changed)
    this._onModelChange?.(next)
    this._onSelectionChange?.(next.selection)
    for (const entry of this._modelListeners) {
      if (meta.viewportOnly && entry.options.includeViewport === false) {
        continue
      }
      entry.listener(next, meta)
    }
    this._host?.onModelCommit(previous, next, meta)
    this._committedModel = next
    return next
  }

  private _resolveCommitMeta(previous: ModelerModel, next: ModelerModel): ModelerCommitMeta {
    const changed: Array<ModelerCommitChange> = []
    if (previous.viewportVersion !== next.viewportVersion) {
      changed.push('viewport')
    }
    if (previous.elementsVersion !== next.elementsVersion) {
      changed.push('data')
    }
    if (previous.bpmnDefinitionsVersion !== next.bpmnDefinitionsVersion) {
      changed.push('bpmnDefinitions')
    }
    if (previous.selectionVersion !== next.selectionVersion) {
      changed.push('selection')
    }
    if (!sameCanvas(previous, next)) {
      changed.push('canvas')
    }
    return {
      changed,
      viewportOnly: changed.length === 1 && changed[0] === 'viewport',
    }
  }

  private _setPluginRuntime(pluginRuntime: ModelerPluginRuntime): void {
    if (pluginRuntime === this._pluginRuntime) {
      return
    }
    this._pluginRuntime.unbindRoot()
    this._pluginLayers = []
    this._pluginGestures = []
    this._pluginRuntime = pluginRuntime
    this._ensureDefaultPlugins()
    this._lastConfiguredActiveToolId = undefined
    if (this._host) {
      this._pluginRuntime.bindRoot(this._pluginContext)
    }
  }

  private _recomputeLayout(): void {
    this._layout = this._createLayout()
  }

  private _createLayout(): ModelerLayout {
    const model = this.getModel()
    return {
      width: this._host?.width ?? 0,
      height: this._host?.height ?? 0,
      canvas: { x: 0, y: 0, width: this._host?.width ?? 0, height: this._host?.height ?? 0 },
      viewport: model.viewport,
      worldBounds: this._resolveCachedWorldBounds(model),
    }
  }

  private _resolveCachedWorldBounds(model: ModelerModel): ModelerRect {
    const signature = createWorldBoundsSignature(model)
    if (this._worldBoundsCache?.signature === signature) {
      return this._worldBoundsCache.bounds
    }
    const bounds = this._resolveWorldBounds(model)
    this._worldBoundsCache = { signature, bounds }
    return bounds
  }

  private _resolveWorldBounds(model: ModelerModel): ModelerRect {
    let bounds: ModelerRect | null = null
    for (const element of model.elements) {
      const elementBounds = isModelerEdgeElement(element)
        ? this._resolveEdgeWorldBounds(element)
        : { x: element.x, y: element.y, width: element.width, height: element.height }
      const labelBounds = this._resolveExternalLabelWorldBounds(element)
      const fullBounds = labelBounds ? unionRects(elementBounds, labelBounds) : elementBounds
      bounds = bounds ? unionRects(bounds, fullBounds) : fullBounds
    }
    return bounds ? expandRect(bounds, MODELER_WORLD_BOUNDS_PADDING_RATIO) : { ...model.canvas }
  }

  private _resolveEdgeWorldBounds(element: ModelerEdgeElement): ModelerRect {
    const points = [element.source.point, ...element.waypoints, element.target.point].filter(
      (point): point is ModelerPoint => Boolean(point),
    )
    if (points.length === 0) {
      return { x: 0, y: 0, width: 1, height: 1 }
    }
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

  private _resolveExternalLabelWorldBounds(element: ModelerElement): ModelerRect | null {
    const pluginContext = (this as unknown as { pluginContext?: ModelerPluginContext }).pluginContext
    if (!pluginContext) {
      return null
    }
    return this._externalLabelRuntime.resolveBounds(pluginContext, element)
  }

  private _clampViewport(viewport: ModelerViewport): ModelerViewport {
    const opts = this._options.current.viewport
    const scale = clamp(viewport.scale, opts?.minZoom ?? 0.1, opts?.maxZoom ?? 3)
    const layout = { ...this._layout, viewport: { ...viewport, scale } }
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

  private _fitViewportToWorld(padding = 80): ModelerViewport {
    const scale = Math.min(
      this._layout.canvas.width / (this._layout.worldBounds.width + padding * 2),
      this._layout.canvas.height / (this._layout.worldBounds.height + padding * 2),
    )
    return this._clampViewport({
      x: this._layout.canvas.width / 2 - (this._layout.worldBounds.x + this._layout.worldBounds.width / 2) * scale,
      y: this._layout.canvas.height / 2 - (this._layout.worldBounds.y + this._layout.worldBounds.height / 2) * scale,
      scale,
    })
  }

  private _addLayer(layer: ModelerPluginLayer): () => void {
    this._pluginLayers.push(layer)
    this._pluginLayers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    this.invalidate('render')
    return () => {
      this._pluginLayers = this._pluginLayers.filter(item => item !== layer)
      this.invalidate('render')
    }
  }

  private _addGesture(gesture: ModelerGesture): () => void {
    this._pluginGestures.push(gesture)
    this._pluginGestures.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    return () => {
      this._pluginGestures = this._pluginGestures.filter(item => item !== gesture)
    }
  }

  private _createPluginContext(): ModelerPluginContext {
    return {
      model: {
        get: () => this.getModel(),
        set: model => this.setModel(model),
        update: updater => this.setModel(updater(this.getModel())),
        subscribe: (listener, options = {}) => {
          const entry: ModelerModelListenerEntry = {
            listener,
            options: { includeViewport: options.includeViewport ?? true },
          }
          this._modelListeners.add(entry)
          return () => this._modelListeners.delete(entry)
        },
      },
      store: {
        provide: (key, value) => {
          this._storeValues.set(key as ModelerStoreKey<unknown>, value)
          return () => {
            if (this._storeValues.get(key as ModelerStoreKey<unknown>) === value) {
              this._storeValues.delete(key as ModelerStoreKey<unknown>)
            }
          }
        },
        inject: key => this._storeValues.get(key as ModelerStoreKey<unknown>) as never,
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
      visibility: this._visibilityRuntime,
      externalLabels: this._externalLabelRuntime,
      layers: {
        add: layer => this._addLayer(layer),
        get: name => this._requireHost().layers.get(name),
        mount: (name, schema) => this._requireHost().layers.mount(name, schema),
        unmount: node => this._requireHost().layers.unmount(node),
        reconcile: (name, ownerId, schema) => this._requireHost().layers.reconcile(name, ownerId, schema),
      },
      gestures: { add: gesture => this._addGesture(gesture) },
      actions: {
        register: definition => this._actions.register(definition),
        get: id => this._actions.get(id),
        getAll: () => this._actions.getAll(),
        run: id => this._actions.run(id),
      },
      elementVariants: {
        register: provider => this._elementVariants.register(provider),
        getAll: () => this._elementVariants.getAll(),
        getProviders: element => this._elementVariants.getProviders(element),
        getProvider: element => this._elementVariants.getProvider(element),
        hasProvider: element => this._elementVariants.hasProvider(element),
      },
      tools: {
        register: definition => this._tools.register(definition),
        get: id => this._tools.get(id),
        getAll: () => this._tools.getAll(),
        activate: id => this._tools.activate(id),
        deactivate: id => this._tools.deactivate(id),
        getActive: () => this._tools.getActive(),
        getActiveId: () => this._tools.getActiveId(),
        createAt: (id, point) => this._tools.createAt(id, point),
        subscribe: listener => this._tools.subscribe(listener),
      },
      palette: {
        register: definition => this._palette.register(definition),
        get: id => this._palette.get(id),
        getAll: () => this._palette.getAll(),
        getItems: () => this._palette.getItems(),
      },
      shortcuts: {
        register: definition => this._shortcuts.register(definition),
        get: id => this._shortcuts.get(id),
        getAll: () => this._shortcuts.getAll(),
        resolve: event => this._shortcuts.resolve(event),
      },
    }
  }

  private _requireHost(): ControllerHost {
    if (!this._host) {
      throw new Error('[Controller] Modeler host is not mounted.')
    }
    return this._host
  }

  static shouldSyncLayerTemplates(previous: ModelerModel, next: ModelerModel): boolean {
    if (previous.id !== next.id) {
      return true
    }
    if (previous.selectionVersion !== next.selectionVersion) {
      return true
    }
    return !sameCanvas(previous, next)
  }

  private _ensureDefaultPlugins(plugins: Array<ModelerPlugin> = []): void {
    if (!this._pluginRuntime.getPlugins().some(plugin => plugin.id === CoreActionsPlugin.ID)) {
      this._pluginRuntime.use(CoreActionsPlugin.create())
    }
    if (!this._pluginRuntime.getPlugins().some(plugin => plugin.id === MODELER_ELEMENTS_PLUGIN_ID)) {
      this._pluginRuntime.use(ElementsPlugin.create())
    }
    plugins.forEach(plugin => this._pluginRuntime.use(plugin))
  }

  private _activateConfiguredTool(): void {
    const configured = this._options.current.interaction?.tools?.activeToolId
    if (configured === this._lastConfiguredActiveToolId) {
      return
    }
    this._lastConfiguredActiveToolId = configured
    if (configured) {
      this._tools.activate(configured)
    }
    else { this._tools.deactivate() }
  }

  private _hitTestElements(point: ModelerPoint): ModelerHitTarget {
    const elements = this.store.elements.items
    if (elements.length === 0) {
      return { type: 'empty' }
    }
    const selected = this.store.selection.ids.length > 0 ? new Set(this.store.selection.ids) : null
    const externalLabelHandle = this._hitTestExternalLabelResizeHandle(point)
    if (externalLabelHandle) {
      return externalLabelHandle
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element) {
        continue
      }
      const definition = this._elementRegistry.get(element.type)
      if (!definition || !selected?.has(element.id)) {
        continue
      }
      const handle = MODEL_ELEMENTS_RUNTIME.handles.createRotateHandle(element, definition)
      if (!handle) {
        continue
      }
      const screen = this.worldToScreen(handle)
      const size = MODELER_ROTATE_HANDLE_SIZE
      if (
        point.x >= screen.x - size / 2
        && point.x <= screen.x + size / 2
        && point.y >= screen.y - size / 2
        && point.y <= screen.y + size / 2
      ) {
        return { type: 'rotate-handle', elementId: element.id }
      }
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element) {
        continue
      }
      const definition = this._elementRegistry.get(element.type)
      if (!definition || !selected?.has(element.id)) {
        continue
      }
      for (const handle of MODEL_ELEMENTS_RUNTIME.handles.createResizeHandles(element, definition)) {
        const screen = this.worldToScreen(handle)
        const size = MODELER_RESIZE_HANDLE_SIZE
        if (
          point.x >= screen.x - size / 2
          && point.x <= screen.x + size / 2
          && point.y >= screen.y - size / 2
          && point.y <= screen.y + size / 2
        ) {
          return { type: 'resize-handle', elementId: element.id, handle: handle.handle }
        }
      }
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element || !selected?.has(element.id) || element.type !== BPMN_PARTICIPANT_TYPE) {
        continue
      }
      const target = this._hitTestBpmnParticipantLaneResizeHandle(point, element as BpmnParticipantElement)
      if (target) {
        return target
      }
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element) {
        continue
      }
      const definition = this._elementRegistry.get(element.type)
      if (!definition || !selected?.has(element.id)) {
        continue
      }
      if (definition.capabilities?.ports === false) {
        continue
      }
      for (const port of MODEL_ELEMENTS_RUNTIME.ports.createElementPorts(
        element,
        definition.getPorts?.(this._pluginContext, element) ?? [],
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
      if (!element || !isModelerEdgeElement(element) || !selected?.has(element.id)) {
        continue
      }
      for (const handle of MODEL_ELEMENTS_RUNTIME.edges.createWaypointHandles(element)) {
        const screen = this.worldToScreen(handle)
        const size = handle.size
        if (
          point.x >= screen.x - size / 2
          && point.x <= screen.x + size / 2
          && point.y >= screen.y - size / 2
          && point.y <= screen.y + size / 2
        ) {
          return { type: 'edge-waypoint-handle', elementId: element.id, waypointIndex: handle.waypointIndex }
        }
      }
    }
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      if (!element || !isModelerEdgeElement(element) || !selected?.has(element.id)) {
        continue
      }
      const handle = MODEL_ELEMENTS_RUNTIME.edges.createSegmentHandleAtPoint(
        this._pluginContext,
        element,
        this.screenToWorld(point),
      )
      if (handle) {
        return { type: 'edge-segment-handle', elementId: element.id, segmentIndex: handle.segmentIndex }
      }
    }
    const ordered = elements.length > 1 ? [...elements].sort(compareElementsByZIndex) : elements
    const externalLabelTarget = this._hitTestExternalLabels(ordered, point)
    if (externalLabelTarget) {
      return externalLabelTarget
    }
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const element = ordered[index]
      if (!element || !isModelerEdgeElement(element)) {
        continue
      }
      const definition = this._elementRegistry.get(element.type)
      if (!definition) {
        continue
      }
      const world = this.screenToWorld(point)
      const contains = definition.hitTest ? definition.hitTest(this._pluginContext, element, world) : false
      if (contains) {
        return { type: 'element', id: element.id }
      }
    }
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const element = ordered[index]
      if (!element || isModelerEdgeElement(element)) {
        continue
      }
      const definition = this._elementRegistry.get(element.type)
      if (!definition) {
        continue
      }
      const world = this.screenToWorld(point)
      const local = MODEL_ELEMENTS_RUNTIME.geometry.unrotatePoint(element, world)
      const contains = definition.hitTest
        ? definition.hitTest(this._pluginContext, element, local)
        : local.x >= element.x
          && local.x <= element.x + element.width
          && local.y >= element.y
          && local.y <= element.y + element.height
      if (contains) {
        const partTarget = definition.hitTestPart?.(this._pluginContext, element, local)
        if (partTarget) {
          return partTarget
        }
        return { type: 'element', id: element.id }
      }
    }
    return { type: 'empty' }
  }

  private _hitTestExternalLabels(ordered: Array<ModelerElement>, point: ModelerPoint): ModelerHitTarget | null {
    const world = this.screenToWorld(point)
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const element = ordered[index]
      if (!element) {
        continue
      }
      const definition = this._elementRegistry.get(element.type)
      if (!definition?.externalLabel) {
        continue
      }
      if (this._externalLabelRuntime.hitTest(this._pluginContext, element, world)) {
        return { type: 'external-label', elementId: element.id }
      }
    }
    return null
  }

  private _hitTestExternalLabelResizeHandle(point: ModelerPoint): ModelerHitTarget | null {
    const selected = this._externalLabelRuntime.getSelected()
    if (!selected) {
      return null
    }
    const element = this.store.elements.items.find(item => item.id === selected.elementId)
    if (!element) {
      return null
    }
    const layout = this._externalLabelRuntime.resolve(this._pluginContext, element)
    if (!layout) {
      return null
    }
    for (const handle of MODELER_EXTERNAL_LABEL_HANDLES) {
      const handlePoint = resolveExternalLabelHandlePoint(layout.screenRect, handle)
      if (
        point.x >= handlePoint.x - MODELER_EXTERNAL_LABEL_HANDLE_SIZE / 2
        && point.x <= handlePoint.x + MODELER_EXTERNAL_LABEL_HANDLE_SIZE / 2
        && point.y >= handlePoint.y - MODELER_EXTERNAL_LABEL_HANDLE_SIZE / 2
        && point.y <= handlePoint.y + MODELER_EXTERNAL_LABEL_HANDLE_SIZE / 2
      ) {
        return { type: 'external-label-resize-handle', elementId: element.id, handle }
      }
    }
    return null
  }

  private _hitTestBpmnParticipantLaneResizeHandle(
    point: ModelerPoint,
    element: BpmnParticipantElement,
  ): ModelerHitTarget | null {
    const layout = createBpmnParticipantLayout(element)
    if (layout.lanes.length <= 1) {
      return null
    }
    const orientation = normalizeBpmnParticipantOrientation(element.data?.orientation)
    for (let index = 0; index < layout.lanes.length - 1; index += 1) {
      const lane = layout.lanes[index]
      if (!lane) {
        continue
      }
      if (orientation === 'vertical') {
        const x = this.worldToScreen({ x: lane.rect.x + lane.rect.width, y: lane.rect.y }).x
        const top = this.worldToScreen({ x: lane.rect.x, y: lane.rect.y }).y
        const bottom = this.worldToScreen({ x: lane.rect.x, y: lane.rect.y + lane.rect.height }).y
        if (
          Math.abs(point.x - x) <= BPMN_LANE_RESIZE_HANDLE_SCREEN_TOLERANCE
          && point.y >= Math.min(top, bottom)
          && point.y <= Math.max(top, bottom)
        ) {
          return { type: 'bpmn-lane-resize-handle', elementId: element.id, laneId: lane.id, orientation }
        }
        continue
      }
      const y = this.worldToScreen({ x: lane.rect.x, y: lane.rect.y + lane.rect.height }).y
      const left = this.worldToScreen({ x: lane.rect.x, y: lane.rect.y }).x
      const right = this.worldToScreen({ x: lane.rect.x + lane.rect.width, y: lane.rect.y }).x
      if (
        Math.abs(point.y - y) <= BPMN_LANE_RESIZE_HANDLE_SCREEN_TOLERANCE
        && point.x >= Math.min(left, right)
        && point.x <= Math.max(left, right)
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
  if (zIndexDelta !== 0) {
    return zIndexDelta
  }
  return resolveElementHitRank(a) - resolveElementHitRank(b)
}

function resolveElementHitRank(element: ModelerElement): number {
  return element.type === BPMN_PARTICIPANT_TYPE ? -1 : 0
}

function resolveExternalLabelHandlePoint(rect: ModelerRect, handle: ModelerResizeHandle): ModelerPoint {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  if (handle === 'n') {
    return { x: centerX, y: rect.y }
  }
  if (handle === 'e') {
    return { x: rect.x + rect.width, y: centerY }
  }
  if (handle === 's') {
    return { x: centerX, y: rect.y + rect.height }
  }
  if (handle === 'w') {
    return { x: rect.x, y: centerY }
  }
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
