import {
  Api,
  Command,
  Event,
  Nova,
  NovaComponent,
  NovaComponentNode,
  NovaPhase,
  NovaTemplateRuntime,
  Prop,
  Watch,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaComponentDescriptor,
  type NovaElementSlots,
  type NovaNode,
  type NovaSurface,
  type NovaTemplateChildSchema,
} from '@endge/nova'
import { NovaUIKit } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import { Modeler } from '@/config/schema.config'
import {
  createModelerModel,
  normalizeModelerModel,
} from '@/model/Store'
import {
  Controller,
  createModelerController,
} from '@/model/Controller'
import { eventPoint } from '@/tools/event-point'
import { MODELER_INPUT_CONFIG } from '@/config/input.config'
import { normalizeModelerOptions } from '@/config/options.config'
import type {
  ControllerHost,
  ModelerController,
  ModelerCommand,
  ModelerGesture,
  ModelerLayerName,
  ModelerLayerSlotProps,
  ModelerLayout,
  ModelerModel,
  ModelerModelInput,
  ModelerOptions,
  ModelerOptionsRef,
  ModelerPlugin,
  ModelerPluginRuntime,
  ModelerPoint,
  ModelerRootApi as RootApi,
  ModelerRootProps as RootProps,
  ModelerRootResolvedProps as RootResolvedProps,
  ModelerViewport,
} from '@/domain/types/index'
import {
  MODELER_CONTEXT,
  MODELER_CONTROLLER,
  MODELER_STORE,
} from '@/config/context.config'
import {
  MODELER_LAYER_NAMES,
  MODELER_SURFACE_CONFIG,
} from '@/config/surface.config'

type RootDescriptor = NovaComponentDescriptor<
  RootResolvedProps,
  RootApi,
  Record<string, never>,
  RootProps
>

@NovaComponent({
  type: Modeler.Root,
  name: 'Root',
  version: '0.22.0',
  dirtyPolicy: {
    update: ['model.version', 'options.version', 'controller', 'pluginRuntime', 'pluginsVersion', 'plugins', 'features'],
    render: ['width', 'height', 'model.viewportVersion'],
  },
})
export class Root<E extends EventList = Record<string, any>>
  extends NovaComponentNode<RootResolvedProps, RootApi, Record<string, never>, RootProps, E> {
  @Prop.model({ required: true })
  declare model: ModelerModel

  @Prop.number({ default: 800 })
  override get width(): number {
    return this.props.width
  }

  override set width(value: number) {
    this.setProps({ width: value })
  }

  @Prop.number({ default: 600 })
  override get height(): number {
    return this.props.height
  }

  override set height(value: number) {
    this.setProps({ height: value })
  }

  @Prop.options<ModelerOptions>({ key: 'options', mode: 'versioned' })
  declare modelerOptions: ModelerOptionsRef

  @Prop.object<ModelerController>()
  declare controller?: ModelerController

  @Prop.object()
  declare elementRegistry?: RootResolvedProps['elementRegistry']

  @Prop.object<ModelerPluginRuntime>()
  declare pluginRuntime?: ModelerPluginRuntime

  @Prop.array<Array<ModelerPlugin>>({ default: () => [] })
  declare plugins: Array<ModelerPlugin>

  @Prop.number({ default: 0 })
  declare pluginsVersion: number

  @Event()
  declare onModelChange?: (model: ModelerModel) => void

  @Event()
  declare onSelectionChange?: (selection: Array<string>) => void

  private controllerInstance: ModelerController
  private controllerHost: ControllerHost
  private layerSlots: NovaElementSlots = {}
  private readonly layerSurfaces = new Map<ModelerLayerName, NovaSurface<E>>()
  private readonly layerRuntimes = new Map<ModelerLayerName, NovaTemplateRuntime<E>>()
  private readonly layerOwnerRuntimes = new Map<string, NovaTemplateRuntime<E>>()
  private layerTemplatesReady = false
  private layerSlotsDirty = true
  private dragState: { type: 'pan'; x: number; y: number } | null = null
  private activePluginGesture: ModelerGesture | null = null
  private spacePressed = false

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: RootDescriptor,
    props: RootResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.controllerHost = this.createControllerHost()
    this.controllerInstance = this.resolveController()
    this.provide(MODELER_STORE, this.controllerInstance.store)
    this.provide(MODELER_CONTROLLER, this.controllerInstance)
    this.provide(MODELER_CONTEXT, this.controllerInstance.getPluginContext())
    this.options({ width: props.width, height: props.height, interactive: true })
    this.nova.theme.observe(this, { phase: NovaPhase.Render })
    this.setupLayerSurfaces()
    this.controllerInstance.mount(this.controllerHost)
    this.setupEvents()
  }

  static normalizeProps(props: RootProps): RootResolvedProps {
    return {
      model: normalizeModelerModel(props.model ?? createModelerModel()),
      width: props.width ?? 1280,
      height: props.height ?? 720,
      options: normalizeModelerOptions(props.options),
      controller: props.controller,
      elementRegistry: props.elementRegistry,
      pluginRuntime: props.pluginRuntime,
      features: {
        marqueeSelection: props.features?.marqueeSelection ?? true,
      },
      plugins: props.plugins ?? [],
      pluginsVersion: props.pluginsVersion ?? 0,
      onModelChange: props.onModelChange,
      onSelectionChange: props.onSelectionChange,
    }
  }

  override getApi(): RootApi {
    return {
      getModel: () => this.getModel(),
      setModel: model => this.setModel(model),
      getViewport: () => this.getViewport(),
      setViewport: viewport => this.setViewport(viewport),
      fitView: () => this.fitView(),
    }
  }

  override setProps(patch: Partial<RootResolvedProps> | RootProps): this {
    const next = Root.normalizeProps({ ...(this.props as RootProps), ...(patch as RootProps) })
    super.setProps(next)
    this.options({ width: this.props.width, height: this.props.height, interactive: true })
    this.syncController(patch)
    this.syncLayerSurfaces()
    this.layerSlotsDirty = true
    this.dirtyLayerSurfaces()
    return this
  }

  protected override onUnmount(): void {
    this.controllerInstance.unmount()
    this.destroyLayerSurfaces()
    super.onUnmount()
  }

  setSlots(slots: NovaElementSlots = {}): this {
    this.layerSlots = { ...slots }
    this.layerSlotsDirty = true
    this.syncLayerTemplates()
    this.dirtyLayerSurfaces()
    return this
  }

  override dirty(
    opts:
      | { matrix?: boolean; update?: boolean; render?: boolean }
      | string
      | Array<string>,
  ): void {
    if (this.shouldSyncLayerSlotsForDirty(opts)) this.layerSlotsDirty = true
    super.dirty(opts)
  }

  @Watch('model.version', { phase: 'update', immediate: true })
  syncModel(): void {
    const current = this.controllerInstance.getModel()
    if (current.id !== this.props.model.id || current.version !== this.props.model.version) {
      this.controllerInstance.setModel(this.props.model)
    }
  }

  update(): void {
    super.update()
    this.controllerInstance.resize(this.props.width, this.props.height)
    if (!this.layerTemplatesReady || this.layerSlotsDirty) this.syncLayerTemplates()
  }

  render(): void {
    super.render()
    const context = this.controllerInstance.getPluginContext()
    this.renderer.schema(this.controllerInstance.getPluginLayers().flatMap(layer => layer.render(context)) as never)
  }

  override containsPoint(x: number, y: number): boolean {
    return x >= 0 && x <= this.props.width && y >= 0 && y <= this.props.height
  }

  @Api()
  setModel(model: ModelerModel | ModelerModelInput): void {
    this.controllerInstance.setModel(normalizeModelerModel(model))
  }

  @Api()
  getModel(): ModelerModel {
    return this.controllerInstance.getModel()
  }

  @Api()
  getViewport(): ModelerViewport {
    return this.controllerInstance.getViewport()
  }

  @Api()
  @Command('modeler.set-viewport')
  setViewport(viewport: Partial<ModelerViewport>): ModelerModel {
    return this.controllerInstance.setViewport(viewport)
  }

  @Api()
  @Command('modeler.fit-view')
  fitView(): ModelerViewport {
    return this.controllerInstance.fitView()
  }

  applyCommand(command: ModelerCommand): ModelerModel {
    return this.controllerInstance.applyCommand(command)
  }

  getLayout(): ModelerLayout {
    return this.controllerInstance.getLayout()
  }

  getOptions(): ModelerOptions {
    return this.controllerInstance.getOptions()
  }

  hitTest(point: ModelerPoint) {
    return this.controllerInstance.hitTest(point)
  }

  screenToWorld(point: ModelerPoint): ModelerPoint {
    return this.controllerInstance.screenToWorld(point)
  }

  worldToScreen(point: ModelerPoint): ModelerPoint {
    return this.controllerInstance.worldToScreen(point)
  }

  invalidate(phase: 'update' | 'render' | 'both' = 'both'): void {
    this.dirty({ update: phase === 'update' || phase === 'both', render: phase === 'render' || phase === 'both' })
    this.dirtyLayerSurfaces(phase)
  }

  private setupLayerSurfaces(): void {
    for (const name of MODELER_LAYER_NAMES) {
      const config = MODELER_SURFACE_CONFIG[name]
      const surface = this.nova.createSurface(`${this.componentId}:${config.name}`)
      surface.options({
        width: this.props.width,
        height: this.props.height,
        zIndex: config.zIndex,
        interactive: config.interactive,
      })
      surface.provide(MODELER_CONTROLLER, this.controllerInstance)
      surface.provide(MODELER_STORE, this.controllerInstance.store)
      surface.provide(MODELER_CONTEXT, this.controllerInstance.getPluginContext())
      this.layerSurfaces.set(name, surface)
      this.layerRuntimes.set(name, new NovaTemplateRuntime(surface))
    }
  }

  private syncLayerSurfaces(): void {
    for (const name of MODELER_LAYER_NAMES) {
      const surface = this.layerSurfaces.get(name)
      if (!surface) continue
      const config = MODELER_SURFACE_CONFIG[name]
      surface.options({
        width: this.props.width,
        height: this.props.height,
        zIndex: config.zIndex,
        interactive: config.interactive,
      })
      surface.provide(MODELER_CONTROLLER, this.controllerInstance)
      surface.provide(MODELER_STORE, this.controllerInstance.store)
      surface.provide(MODELER_CONTEXT, this.controllerInstance.getPluginContext())
      surface.dirty({ update: true, matrix: true, render: true })
    }
  }

  private destroyLayerSurfaces(): void {
    for (const runtime of this.layerOwnerRuntimes.values()) {
      runtime.dispose()
    }
    this.layerOwnerRuntimes.clear()
    for (const surface of this.layerSurfaces.values()) {
      this.nova.removeSurface(surface)
    }
    this.layerSurfaces.clear()
    this.layerRuntimes.clear()
  }

  private syncLayerTemplates(): void {
    const slotProps = this.createLayerSlotProps()
    for (const name of MODELER_LAYER_NAMES) {
      const runtime = this.layerRuntimes.get(name)
      if (!runtime) continue
      runtime.reconcile(this.resolveLayerSchema(name, slotProps))
    }
    this.layerTemplatesReady = true
    this.layerSlotsDirty = false
  }

  private resolveLayerSchema(name: ModelerLayerName, slotProps: ModelerLayerSlotProps): Array<NovaTemplateChildSchema> {
    const slot = this.layerSlots[name]
    if (slot) {
      const schema = Nova.trackNode(this, () => slot(slotProps), { mode: 'append' })
      return Array.isArray(schema) ? schema as Array<NovaTemplateChildSchema> : []
    }
    return this.createDefaultLayerSchema(name)
  }

  private createDefaultLayerSchema(name: ModelerLayerName): Array<NovaTemplateChildSchema> {
    if (name === 'background') {
      return [
        { type: Modeler.Background, id: `${this.componentId}:background` },
        { type: Modeler.Grid, id: `${this.componentId}:grid` },
      ]
    }
    if (name === 'interaction') {
      return []
    }
    if (name === 'controls') {
      return [
        {
          type: NovaUIKit.Flex,
          id: `${this.componentId}:default-controls`,
          props: {
            alignItems: 'center',
            position: 'fixed',
            inset: { top: 16, right: 16 },
            height: 36,
            zIndex: 3000,
          },
          children: [
            {
              type: Modeler.ZoomControls,
              id: `${this.componentId}:zoom-controls`,
              props: { position: 'static', controller: this.controllerInstance },
            },
          ],
        },
      ]
    }
    return []
  }

  private createLayerSlotProps(): ModelerLayerSlotProps {
    return {
      model: this.controllerInstance.getModel(),
      layout: this.controllerInstance.getLayout(),
      viewport: this.controllerInstance.getViewport(),
      options: this.controllerInstance.getOptions(),
    }
  }

  private dirtyLayerSurfaces(phase: 'update' | 'render' | 'both' = 'both'): void {
    for (const surface of this.layerSurfaces.values()) {
      surface.dirty({
        update: phase === 'update' || phase === 'both',
        render: phase === 'render' || phase === 'both',
      })
    }
  }

  private getLayerSurface(name: ModelerLayerName): NovaSurface<E> {
    const surface = this.layerSurfaces.get(name)
    if (!surface) throw new Error(`[Root] Layer surface "${name}" is not available.`)
    return surface
  }

  private mountLayerNode(name: ModelerLayerName, schema: NovaTemplateChildSchema): NovaNode<E> {
    const surface = this.getLayerSurface(name)
    const node = this.nova.schema.createChild(surface, schema as never) as NovaNode<E>
    surface.dirty({ update: true, matrix: true, render: true })
    return node
  }

  private reconcileLayerOwner(name: ModelerLayerName, ownerId: string, schema: Array<NovaTemplateChildSchema>): () => void {
    const key = `${name}:${ownerId}`
    const surface = this.getLayerSurface(name)
    let runtime = this.layerOwnerRuntimes.get(key)
    if (!runtime) {
      runtime = new NovaTemplateRuntime(surface)
      this.layerOwnerRuntimes.set(key, runtime)
    }
    runtime.reconcile(schema)
    surface.dirty({ update: true, matrix: true, render: true })
    return () => {
      runtime?.dispose()
      this.layerOwnerRuntimes.delete(key)
      surface.dirty({ render: true })
    }
  }

  private createControllerHost(): ControllerHost {
    return {
      id: this.id,
      app: this.nova,
      width: this.props.width,
      height: this.props.height,
      invalidate: phase => this.invalidate(phase),
      onModelCommit: (previous, next) => {
        this.props.model = next
        if (Controller.shouldSyncLayerTemplates(previous, next)) {
          this.layerSlotsDirty = true
          this.syncLayerTemplates()
        }
      },
      layers: {
        get: name => this.getLayerSurface(name),
        mount: (name, schema) => this.mountLayerNode(name, schema),
        unmount: node => node.remove(),
        reconcile: (name, ownerId, schema) => this.reconcileLayerOwner(name, ownerId, schema),
      },
    }
  }

  private resolveController(): ModelerController {
    return this.props.controller ?? createModelerController({
      model: this.props.model,
      options: this.props.options,
      elementRegistry: this.props.elementRegistry,
      pluginRuntime: this.props.pluginRuntime,
      plugins: this.props.plugins,
      onModelChange: this.props.onModelChange,
      onSelectionChange: this.props.onSelectionChange,
    })
  }

  private syncController(patch: Partial<RootResolvedProps> | RootProps): void {
    const nextController = this.props.controller ?? this.controllerInstance
    if (nextController !== this.controllerInstance) {
      this.controllerInstance.unmount()
      this.controllerInstance = nextController
      this.provide(MODELER_CONTROLLER, this.controllerInstance)
      this.provide(MODELER_STORE, this.controllerInstance.store)
      this.provide(MODELER_CONTEXT, this.controllerInstance.getPluginContext())
      this.controllerInstance.mount(this.controllerHost)
      this.syncLayerSurfaces()
      return
    }
    const hasPluginPatch = Object.prototype.hasOwnProperty.call(patch, 'pluginRuntime')
      || Object.prototype.hasOwnProperty.call(patch, 'plugins')
      || Object.prototype.hasOwnProperty.call(patch, 'pluginsVersion')
    this.controllerInstance.configure({
      model: Object.prototype.hasOwnProperty.call(patch, 'model') ? this.props.model : undefined,
      options: this.props.options,
      elementRegistry: this.props.elementRegistry,
      pluginRuntime: hasPluginPatch ? this.props.pluginRuntime : undefined,
      plugins: hasPluginPatch ? this.props.plugins : undefined,
      onModelChange: this.props.onModelChange,
      onSelectionChange: this.props.onSelectionChange,
    })
    this.controllerInstance.resize(this.props.width, this.props.height)
  }

  private setupEvents(): void {
    this.on('mousedown', event => {
      const point = eventPoint(event)
      const target = this.hitTest(point)
      const context = this.controllerInstance.getPluginContext()
      for (const gesture of this.controllerInstance.getGestures()) {
        if (!gesture.hitTest?.(context, event, target)) continue
        this.activePluginGesture = gesture
        const result = gesture.onPointerDown?.(context, event)
        if (result === false) return false
      }
      if (this.shouldStartPan(event)) {
        this.dragState = { type: 'pan', x: point.x, y: point.y }
        return false
      }
      return false
    })
    this.on('mousemove', event => {
      if (this.activePluginGesture) {
        const result = this.activePluginGesture.onPointerMove?.(this.controllerInstance.getPluginContext(), event)
        if (result === false) return false
      }
      if (!this.dragState) return false
      if (event.buttons === 0) {
        this.dragState = null
        return false
      }
      const point = eventPoint(event)
      const dx = point.x - this.dragState.x
      const dy = point.y - this.dragState.y
      const viewport = this.controllerInstance.getViewport()
      this.dragState = { type: 'pan', x: point.x, y: point.y }
      this.setViewport({ x: viewport.x + dx, y: viewport.y + dy })
      return false
    })
    this.on('mouseup', event => {
      if (this.activePluginGesture) {
        const gesture = this.activePluginGesture
        this.activePluginGesture = null
        const result = gesture.onPointerUp?.(this.controllerInstance.getPluginContext(), event)
        if (result === false) return false
      }
      this.dragState = null
      return false
    })
    this.on('wheel', event => {
      if (event.ctrlKey || event.metaKey) {
        this.zoomViewport(eventPoint(event), event.deltaY)
        return false
      }
      const viewport = this.controllerInstance.getViewport()
      this.setViewport({
        x: viewport.x - (Number.isFinite(event.deltaX) ? event.deltaX : 0),
        y: viewport.y - (Number.isFinite(event.deltaY) ? event.deltaY : 0),
      })
      return false
    })
    this.on('zoom', event => {
      this.zoomViewport(eventPoint(event), event.deltaY)
      return false
    })
    this.on('keydown', event => {
      if (event.key === ' ') {
        this.spacePressed = true
        return false
      }
      if (event.key === 'Escape' && this.activePluginGesture) {
        this.activePluginGesture.onCancel?.(this.controllerInstance.getPluginContext())
        this.activePluginGesture = null
        return false
      }
    })
    this.on('keyup', event => {
      if (event.key === ' ') this.spacePressed = false
    })
  }

  private shouldStartPan(event: MouseEvent): boolean {
    const panMode = this.controllerInstance.getOptions().viewport?.panMode ?? 'both'
    if (event.button === 1) return true
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) return false
    return panMode === 'both' || panMode === 'drag-empty' || (panMode === 'space-drag' && this.spacePressed)
  }

  private zoomViewport(point: ModelerPoint, deltaY: number): void {
    const oldViewport = this.controllerInstance.getViewport()
    const opts = this.controllerInstance.getOptions().viewport
    const nextScale = Math.min(
      opts?.maxZoom ?? 3,
      Math.max(
        opts?.minZoom ?? 0.1,
        oldViewport.scale * Math.exp(-deltaY * MODELER_INPUT_CONFIG.touchpadZoomSensitivity * (opts?.wheelZoomSpeed ?? 1)),
      ),
    )
    const world = this.controllerInstance.screenToWorld(point)
    this.setViewport({
      x: point.x - world.x * nextScale,
      y: point.y - world.y * nextScale,
      scale: nextScale,
    })
  }

  private shouldSyncLayerSlotsForDirty(
    opts:
      | { matrix?: boolean; update?: boolean; render?: boolean }
      | string
      | Array<string>,
  ): boolean {
    if (Object.keys(this.layerSlots).length === 0) return false
    if (typeof opts === 'string') return opts === 'update'
    if (Array.isArray(opts)) return opts.includes('update')
    return !!opts.update
  }
}

export const MODELER_ROOT_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  RootResolvedProps,
  RootApi,
  Record<string, never>,
  RootProps
>(Root as never) as RootDescriptor
