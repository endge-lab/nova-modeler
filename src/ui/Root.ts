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
  type NovaCursorDeclaration,
  type NovaElementSlots,
  type NovaNode,
  type NovaSurface,
  type NovaTemplateChildSchema,
} from '@endge/nova'
import {
  NovaUIKit,
  type InputApi,
  type NovaTooltipTargetResolver,
  type TooltipInput,
  type TooltipTargetResolution,
} from '@endge/nova-ui-kit'
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
import { SelectionRuntime } from '@/model/selection/SelectionRuntime'
import { eventPoint } from '@/tools/event-point'
import { MODELER_INPUT_CONFIG } from '@/config/input.config'
import { normalizeModelerOptions } from '@/config/options.config'
import type {
  ControllerHost,
  ModelerController,
  ModelerCommand,
  ModelerGesture,
  ModelerHitTarget,
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
  ModelerRect,
  ModelerRootApi as RootApi,
  ModelerRootProps as RootProps,
  ModelerRootResolvedProps as RootResolvedProps,
  ModelerViewport,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import type { ContextPadApi } from '@/domain/types/controls/context-pad.types'
import {
  MODELER_CONTEXT,
  MODELER_CONTROLLER,
  MODELER_STORE,
} from '@/config/context.config'
import {
  MODELER_LAYER_NAMES,
  MODELER_SURFACE_CONFIG,
} from '@/config/surface.config'
import {
  BPMN_DATA_STORE_TYPE,
} from '@/elements/bpmn/data/data-store/bpmn-data-store.factory'
import type { BpmnDataStoreElement } from '@/elements/bpmn/data/data-store/bpmn-data-store.types'
import {
  BPMN_GROUP_TYPE,
} from '@/elements/bpmn/artifacts/group/bpmn-group.factory'
import type { BpmnGroupElement } from '@/elements/bpmn/artifacts/group/bpmn-group.types'
import {
  BPMN_CALL_ACTIVITY_TYPE,
} from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import type { BpmnCallActivityElement } from '@/elements/bpmn/call-activity/bpmn-call-activity.types'
import {
  BPMN_SUB_PROCESS_TYPE,
} from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import type { BpmnSubProcessElement } from '@/elements/bpmn/sub-process/bpmn-sub-process.types'
import {
  BPMN_TASK_TYPE,
} from '@/elements/bpmn/task/bpmn-task.factory'
import type { BpmnTaskElement } from '@/elements/bpmn/task/bpmn-task.types'
import {
  BPMN_PARTICIPANT_TYPE,
  renameBpmnParticipantLane,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import { resolveBpmnActivityNameLayout } from '@/ui/elements/bpmn/activity/BpmnActivityView'
import {
  resolveBpmnTaskNameLayout,
  type BpmnTaskNameLayout,
} from '@/ui/elements/bpmn/task/BpmnTaskView'
import { resolveBpmnDataStoreNameLayout } from '@/ui/elements/bpmn/data/data-store/BpmnDataStoreView'
import { resolveBpmnGroupNameLayout } from '@/ui/elements/bpmn/artifacts/group/BpmnGroupView'
import { resolveBpmnParticipantNameLayout } from '@/ui/elements/bpmn/participant/BpmnParticipantView'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'

type EditableNameElement = BpmnTaskElement | BpmnSubProcessElement | BpmnCallActivityElement | BpmnDataStoreElement | BpmnGroupElement | BpmnParticipantElement
type EditableNameKind = 'task' | 'activity' | 'dataStore' | 'group' | 'participant' | 'lane'
type EditableNamePart = { partType?: string; partId?: string }

type RootDescriptor = NovaComponentDescriptor<
  RootResolvedProps,
  RootApi,
  Record<string, never>,
  RootProps
>

const MODELER_CURSOR_RULES: NovaCursorDeclaration = [
  { when: { modelerCursor: 'ns-resize' }, use: 'ns-resize' },
  { when: { modelerCursor: 'ew-resize' }, use: 'ew-resize' },
  { when: { modelerCursor: 'nesw-resize' }, use: 'nesw-resize' },
  { when: { modelerCursor: 'nwse-resize' }, use: 'nwse-resize' },
  { when: { state: ['pressed', 'dragging'], modelerCursor: 'rotate' }, use: 'grabbing' },
  { when: { modelerCursor: 'rotate' }, use: 'grab' },
  { when: { state: ['pressed', 'dragging'], modelerCursor: 'element' }, use: 'grabbing' },
  { when: { modelerCursor: 'element' }, use: 'move' },
  { when: { state: ['pressed', 'dragging'], modelerCursor: 'edge-handle' }, use: 'grabbing' },
  { when: { modelerCursor: 'edge-handle' }, use: 'grab' },
  { when: { modelerCursor: 'pointer' }, use: 'pointer' },
  { when: { modelerCursor: 'port' }, use: 'pointer' },
  { when: { state: ['pressed', 'dragging'], modelerCursor: 'pan' }, use: 'grabbing' },
  { when: { modelerCursor: 'pan' }, use: 'grab' },
  { use: 'default' },
]

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
  extends NovaComponentNode<RootResolvedProps, RootApi, Record<string, never>, RootProps, E>
  implements NovaTooltipTargetResolver {
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
  private activeModelerCursor: string | null = null
  private currentModelerCursor = 'default'
  private spacePressed = false
  private temporaryToolId: string | null = null
  private taskNameEditor: { elementId: string; kind: EditableNameKind; part?: EditableNamePart } | null = null
  private hiddenTaskNameElementId: string | null = null
  private disposeTaskNameEditorLayer?: () => void
  private lastTaskNamePointerDown: { elementId: string; partKey: string; x: number; y: number; time: number } | null = null
  private readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    if (this.handleEscapeKey(event)) event.preventDefault()
  }

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
    this.options({
      width: props.width,
      height: props.height,
      interactive: true,
      cursor: MODELER_CURSOR_RULES,
      cursorContext: { modelerCursor: this.currentModelerCursor },
    })
    this.nova.theme.observe(this, { phase: NovaPhase.Render })
    this.setupLayerSurfaces()
    this.controllerInstance.mount(this.controllerHost)
    this.setupEvents()
    this.setupWindowEvents()
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
    this.options({
      width: this.props.width,
      height: this.props.height,
      interactive: true,
      cursor: MODELER_CURSOR_RULES,
      cursorContext: { modelerCursor: this.currentModelerCursor },
    })
    this.syncController(patch)
    this.syncLayerSurfaces()
    this.layerSlotsDirty = true
    this.dirtyLayerSurfaces()
    return this
  }

  protected override onUnmount(): void {
    this.teardownWindowEvents()
    this.clearTaskNameEditorLayer()
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
    this.closeTaskNameEditor({ commit: true })
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

  resolveNovaTooltipTarget(input: { x: number; y: number; event?: MouseEvent }): TooltipTargetResolution | null {
    const target = this.controllerInstance.hitTest({ x: input.x, y: input.y })
    const elementId = this.resolveHitTargetElementId(target)
    if (!elementId) return null
    const element = this.controllerInstance.getModel().elements.find(item => item.id === elementId)
    if (!element || !this.isEditableNameElement(element)) return null
    if (this.taskNameEditor?.elementId === element.id) return null
    const part = target.type === 'element-part' ? { partType: target.partType, partId: target.partId } : undefined
    if (!this.containsTaskNamePoint(element, input, part)) return null
    const layout = this.resolveTaskNameScreenLayout(element, part)
    if (!layout.clipped) return null
    const targetType = this.resolveNameEditorTargetType(element)
    return {
      tooltip: {
        value: layout.text,
        placement: 'top',
        delay: 350,
      } as TooltipInput,
      rect: layout.rect,
      targetId: `${element.id}:name`,
      targetType,
      targetProps: { elementId: element.id },
    }
  }

  private resolveTaskNameScreenLayout(element: EditableNameElement, part: EditableNamePart | undefined = this.taskNameEditor?.part): BpmnTaskNameLayout {
    const viewport = this.controllerInstance.getViewport()
    const width = element.width * viewport.scale
    const height = element.height * viewport.scale
    let layout: BpmnTaskNameLayout
    if (element.type === BPMN_PARTICIPANT_TYPE) {
      const participant = element as BpmnParticipantElement
      layout = resolveBpmnParticipantNameLayout({
        element: participant,
        width,
        height,
        partType: part?.partType,
        partId: part?.partId,
      })
    } else if (element.type === BPMN_DATA_STORE_TYPE) {
      layout = resolveBpmnDataStoreNameLayout({
          name: element.data?.name,
          width,
          height,
        })
    } else if (element.type === BPMN_GROUP_TYPE) {
      layout = resolveBpmnGroupNameLayout({
            name: element.data?.name,
            width,
            height,
          })
    } else if (element.type === BPMN_SUB_PROCESS_TYPE || element.type === BPMN_CALL_ACTIVITY_TYPE) {
      layout = resolveBpmnActivityNameLayout({
              name: element.data?.name,
              width,
              height,
              data: element.data,
            })
    } else {
      layout = resolveBpmnTaskNameLayout({
              name: element.data?.name,
              width,
              height,
              data: element.data,
            })
    }
    const center = this.controllerInstance.worldToScreen({
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
    })
    return {
      ...layout,
      rect: {
        x: center.x + layout.rect.x,
        y: center.y + layout.rect.y,
        width: layout.rect.width,
        height: layout.rect.height,
      },
      lines: layout.lines.map(line => ({
        ...line,
        x: center.x + line.x,
        y: center.y + line.y,
      })),
    }
  }

  private resolveTaskNameContentRect(element: EditableNameElement, part?: EditableNamePart): ModelerRect {
    return this.resolveTaskNameScreenLayout(element, part).rect
  }

  private resolveTaskNameEditorRect(element: EditableNameElement): ModelerRect {
    const layout = this.resolveTaskNameScreenLayout(element)
    if (element.type === BPMN_DATA_STORE_TYPE || element.type === BPMN_GROUP_TYPE || element.type === BPMN_PARTICIPANT_TYPE) {
      return {
        x: layout.rect.x - 10,
        y: layout.rect.y - 8,
        width: layout.rect.width + 20,
        height: layout.rect.height + 16,
      }
    }
    const firstLineY = layout.lines[0]?.y ?? layout.rect.y
    return {
      x: layout.rect.x - 10,
      y: firstLineY - 8,
      width: layout.rect.width + 20,
      height: Math.max(28, layout.rect.y + layout.rect.height - firstLineY + 16),
    }
  }

  private resolveTaskNameEditorFontSize(element: EditableNameElement): number {
    return this.resolveTaskNameScreenLayout(element).fontSize
  }

  private resolveTaskNameEditorLineHeight(element: EditableNameElement): number {
    return this.resolveTaskNameScreenLayout(element).lineHeight
  }

  private resolveTaskNameEditorMaxRows(element: EditableNameElement): number {
    const layout = this.resolveTaskNameScreenLayout(element)
    return Math.max(1, Math.floor(layout.rect.height / layout.lineHeight))
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
    if (name === 'links') {
      return []
    }
    if (name === 'interaction') {
      return []
    }
    if (name === 'controls') {
      const options = this.controllerInstance.getOptions()
      const paletteOptions = options.palette ?? {}
      const brandVisible = options.branding?.visible !== false
      const palettePlacement = paletteOptions.placement ?? 'left'
      const paletteOffsetY = paletteOptions.offsetY ?? (brandVisible && palettePlacement === 'left' ? 88 : undefined)
      return [
        ...(brandVisible
          ? [{
              type: Modeler.BrandLogo,
              id: `${this.componentId}:brand-logo`,
              props: {
                zIndex: 3000,
              },
            } as NovaTemplateChildSchema]
          : []),
        {
          type: Modeler.Palette,
          id: `${this.componentId}:palette`,
          props: {
            controller: this.controllerInstance,
            position: 'fixed',
            zIndex: 3000,
            placement: paletteOptions.placement,
            draggable: paletteOptions.draggable,
            offset: paletteOptions.offset,
            offsetX: paletteOptions.offsetX,
            offsetY: paletteOffsetY,
            itemSize: paletteOptions.itemSize,
            gap: paletteOptions.gap,
            padding: paletteOptions.padding,
            gripSize: paletteOptions.gripSize,
          },
        },
        {
          type: Modeler.ContextPad,
          id: `${this.componentId}:context-pad`,
          props: { controller: this.controllerInstance },
        },
        {
          type: Modeler.DownloadControls,
          id: `${this.componentId}:download-controls`,
          props: {
            controller: this.controllerInstance,
            zIndex: 3000,
          },
        },
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
              type: Modeler.BpmnValidationBadge,
              id: `${this.componentId}:bpmn-validation-badge`,
              props: {
                controller: this.controllerInstance,
                position: 'static',
              },
            },
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
      if (this.taskNameEditor && !this.isTaskNameEditorPointer(point)) {
        this.closeTaskNameEditor({ commit: true })
      }
      const target = this.hitTest(point)
      if (event.button === 0 && this.openTaskNameEditorOnDoublePointerDown(target, point)) return false
      this.setModelerCursorFromTarget(target)
      const context = this.controllerInstance.getPluginContext()
      for (const gesture of this.controllerInstance.getGestures()) {
        if (!gesture.hitTest?.(context, event, target)) continue
        const hasPointerContinuation = Boolean(gesture.onPointerMove || gesture.onPointerUp || gesture.onCancel)
        this.activePluginGesture = hasPointerContinuation ? gesture : null
        this.activeModelerCursor = hasPointerContinuation ? this.resolveModelerCursor(target) : null
        if (this.activeModelerCursor) this.setModelerCursor(this.activeModelerCursor)
        const result = gesture.onPointerDown?.(context, event)
        if (result === false) return false
      }
      if (event.button === 0 && target.type === 'canvas' && this.applyActiveCreateTool(point)) {
        return false
      }
      if (
        event.button === 0
        && (target.type === 'canvas' || target.type === 'empty')
        && SelectionRuntime.shouldClearOnCanvasPointerDown(this.controllerInstance.getOptions().interaction?.selection)
      ) {
        this.clearSelection()
      }
      if (this.shouldStartPan(event)) {
        this.closeContextPadMenus()
        this.closeTaskNameEditor({ commit: true })
        this.dragState = { type: 'pan', x: point.x, y: point.y }
        this.activeModelerCursor = 'pan'
        this.setModelerCursor('pan')
        return false
      }
      return false
    })
    this.on('mousemove', event => {
      const point = eventPoint(event)
      const target = this.hitTest(point)
      if (this.activeModelerCursor) {
        this.setModelerCursor(this.activeModelerCursor)
      } else {
        this.setModelerCursorFromTarget(target)
      }
      this.syncEdgeSegmentHover(target, point)
      if (this.activePluginGesture) {
        const result = this.activePluginGesture.onPointerMove?.(this.controllerInstance.getPluginContext(), event)
        if (result === false) return false
      }
      if (!this.activePluginGesture) {
        const activeTool = this.controllerInstance.getPluginContext().tools.getActive()
        const result = activeTool?.onPointerMove?.(this.controllerInstance.getPluginContext(), event)
        if (result === false) return false
      }
      if (!this.dragState) return false
      if (event.buttons === 0) {
        this.dragState = null
        this.activeModelerCursor = null
        this.setModelerCursorFromTarget(this.hitTest(eventPoint(event)))
        return false
      }
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
        this.activeModelerCursor = null
        const result = gesture.onPointerUp?.(this.controllerInstance.getPluginContext(), event)
        this.setModelerCursorFromTarget(this.hitTest(eventPoint(event)))
        if (result === false) return false
      }
      this.dragState = null
      this.activeModelerCursor = null
      MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.clear()
      this.setModelerCursorFromTarget(this.hitTest(eventPoint(event)))
      return false
    })
    this.on('wheel', event => {
      if (event.ctrlKey || event.metaKey) {
        this.closeContextPadMenus()
        this.closeTaskNameEditor({ commit: true })
        this.zoomViewport(eventPoint(event), event.deltaY)
        return false
      }
      this.closeContextPadMenus()
      this.closeTaskNameEditor({ commit: true })
      const viewport = this.controllerInstance.getViewport()
      this.setViewport({
        x: viewport.x - (Number.isFinite(event.deltaX) ? event.deltaX : 0),
        y: viewport.y - (Number.isFinite(event.deltaY) ? event.deltaY : 0),
      })
      return false
    })
    this.on('zoom', event => {
      this.closeContextPadMenus()
      this.closeTaskNameEditor({ commit: true })
      this.zoomViewport(eventPoint(event), event.deltaY)
      return false
    })
    this.on('dblclick', event => {
      this.openTaskNameEditorFromPoint(eventPoint(event))
      return false
    })
    this.on('keydown', event => {
      if (event.key === 'Shift' && !event.repeat && this.activateTemporaryMarqueeTool()) {
        return false
      }
      if (event.key === 'Escape' && this.handleEscapeKey(event)) return false
      const shortcut = this.controllerInstance.getPluginContext().shortcuts.resolve(event)
      if (shortcut) {
        if (shortcut.shortcut.preventDefault !== false) event.preventDefault()
        if (shortcut.definition.actionId) {
          this.controllerInstance.getPluginContext().actions.run(shortcut.definition.actionId)
        }
        if (shortcut.definition.toolId) {
          this.controllerInstance.getPluginContext().tools.activate(shortcut.definition.toolId)
        }
        return false
      }
      if (event.key === ' ') {
        this.spacePressed = true
        if (!this.activeModelerCursor) this.setModelerCursor('pan')
        return false
      }
    })
    this.on('keyup', event => {
      if (event.key === 'Shift') {
        this.deactivateTemporaryTool('marqueeSelection')
        return false
      }
      if (event.key === ' ') {
        this.spacePressed = false
        if (!this.activeModelerCursor) this.setModelerCursor('default')
      }
    })
  }

  private clearSelection(): void {
    if (this.controllerInstance.getModel().selection.length === 0) return
    this.controllerInstance.applyCommand({ type: 'select', ids: [] })
  }

  private setupWindowEvents(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('keydown', this.handleWindowKeyDown, true)
  }

  private teardownWindowEvents(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('keydown', this.handleWindowKeyDown, true)
  }

  private handleEscapeKey(event?: KeyboardEvent): boolean {
    if (this.taskNameEditor) {
      this.closeTaskNameEditor({ commit: false })
      return true
    }
    if (this.activePluginGesture) {
      this.activePluginGesture.onCancel?.(this.controllerInstance.getPluginContext())
      this.activePluginGesture = null
      this.activeModelerCursor = null
      this.setModelerCursor('default')
      return true
    }
    this.closeContextPadMenus()
    const context = this.controllerInstance.getPluginContext()
    const activeTool = context.tools.getActive()
    activeTool?.onCancel?.(context)
    context.tools.deactivate()
    event?.preventDefault()
    return true
  }

  private applyActiveCreateTool(point: ModelerPoint): boolean {
    const context = this.controllerInstance.getPluginContext()
    const activeTool = context.tools.getActive()
    if (!activeTool || activeTool.kind !== 'create-element') return false
    const world = context.screenToWorld(point)
    return !!context.tools.createAt(activeTool.id, world)
  }

  private activateTemporaryMarqueeTool(): boolean {
    const tools = this.controllerInstance.getPluginContext().tools
    if (tools.getActiveId()) return false
    if (!tools.activate('marqueeSelection')) return false
    this.temporaryToolId = 'marqueeSelection'
    return true
  }

  private deactivateTemporaryTool(toolId: string): void {
    if (this.temporaryToolId !== toolId) return
    this.temporaryToolId = null
    this.controllerInstance.getPluginContext().tools.deactivate(toolId)
  }

  private openTaskNameEditorFromPoint(point: ModelerPoint): boolean {
    const target = this.hitTest(point)
    const elementId = this.resolveHitTargetElementId(target)
    if (!elementId) return false
    const element = this.controllerInstance.getModel().elements.find(item => item.id === elementId)
    if (!element || !this.isEditableNameElement(element)) return false
    const part = target.type === 'element-part' ? { partType: target.partType, partId: target.partId } : undefined
    if (!this.containsTaskNamePoint(element, point, part)) return false
    this.taskNameEditor = { elementId: element.id, kind: this.resolveNameEditorKind(element, part), part }
    this.syncTaskNameEditor()
    return true
  }

  private openTaskNameEditorOnDoublePointerDown(target: ModelerHitTarget, point: ModelerPoint): boolean {
    const elementId = this.resolveHitTargetElementId(target)
    if (!elementId) {
      this.lastTaskNamePointerDown = null
      return false
    }
    const element = this.controllerInstance.getModel().elements.find(item => item.id === elementId)
    const part = target.type === 'element-part' ? { partType: target.partType, partId: target.partId } : undefined
    if (!element || !this.isEditableNameElement(element) || !this.containsTaskNamePoint(element, point, part)) {
      this.lastTaskNamePointerDown = null
      return false
    }
    const now = Date.now()
    const previous = this.lastTaskNamePointerDown
    const partKey = `${part?.partType ?? ''}:${part?.partId ?? ''}`
    const isDouble = previous?.elementId === element.id
      && previous.partKey === partKey
      && now - previous.time <= 500
      && Math.abs(previous.x - point.x) <= 4
      && Math.abs(previous.y - point.y) <= 4
    this.lastTaskNamePointerDown = { elementId: element.id, partKey, x: point.x, y: point.y, time: now }
    if (!isDouble) return false
    this.lastTaskNamePointerDown = null
    this.taskNameEditor = { elementId: element.id, kind: this.resolveNameEditorKind(element, part), part }
    this.syncTaskNameEditor()
    return true
  }

  private syncTaskNameEditor(): void {
    if (!this.taskNameEditor) {
      this.clearTaskNameEditorLayer()
      return
    }
    const element = this.controllerInstance.getModel().elements.find(item => item.id === this.taskNameEditor?.elementId)
    if (!element || !this.isEditableNameElement(element)) {
      this.closeTaskNameEditor({ commit: false })
      return
    }
    const rect = this.resolveTaskNameEditorRect(element)
    this.setTaskNameViewLabelHidden(element.id)
    this.clearTaskNameEditorLayer()
    this.disposeTaskNameEditorLayer = this.reconcileLayerOwner('controls', `${this.componentId}:task-name-editor`, [{
      type: NovaUIKit.TextArea,
      id: this.taskNameEditorInputId(),
      props: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        value: this.resolveEditableNameValue(element),
        inputEngine: 'canvas',
        size: 'sm',
        variant: 'ghost',
        align: this.resolveNameEditorAlign(element),
        wrap: true,
        resize: 'none',
        minRows: 1,
        maxRows: this.resolveTaskNameEditorMaxRows(element),
        color: 'var(--modeler-bpmn-task-text-color, #111827)',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: this.resolveTaskNameEditorFontSize(element),
        fontWeight: '500',
        lineHeight: this.resolveTaskNameEditorLineHeight(element),
        background: 'rgba(255,255,255,0)',
        border: { width: 0 },
        hoverBackground: 'rgba(255,255,255,0)',
        pressedBackground: 'rgba(255,255,255,0)',
        activeBackground: 'rgba(255,255,255,0)',
        focusBorderColor: 'rgba(255,255,255,0)',
        autofocus: true,
        selectOnFocus: false,
        zIndex: 3100,
        onCommit: (value: string) => {
          this.applyTaskNameEditorValue(String(value ?? ''))
          this.closeTaskNameEditor({ commit: false })
        },
        onCancel: () => {
          this.closeTaskNameEditor({ commit: false })
        },
      },
    }])
  }

  private closeTaskNameEditor(options: { commit: boolean }): void {
    if (!this.taskNameEditor) return
    if (options.commit) {
      const draft = this.nova.components.api<InputApi>(this.taskNameEditorInputId())?.getState().draft
      if (draft !== undefined) this.applyTaskNameEditorValue(draft)
    }
    this.taskNameEditor = null
    this.clearTaskNameEditorLayer()
    this.setTaskNameViewLabelHidden(null)
  }

  private clearTaskNameEditorLayer(): void {
    this.disposeTaskNameEditorLayer?.()
    this.disposeTaskNameEditorLayer = undefined
  }

  private setTaskNameViewLabelHidden(elementId: string | null): void {
    if (this.hiddenTaskNameElementId && this.hiddenTaskNameElementId !== elementId) {
      this.patchTaskNameViewLabel(this.hiddenTaskNameElementId, false)
    }
    this.hiddenTaskNameElementId = elementId
    if (elementId) this.patchTaskNameViewLabel(elementId, true)
  }

  private patchTaskNameViewLabel(elementId: string, hideName: boolean): void {
    const view = this.nova.components.get(`${elementId}:view`) as { setProps?: (props: Record<string, unknown>) => void } | undefined
    view?.setProps?.({ hideName })
  }

  private applyTaskNameEditorValue(value: string): void {
    const elementId = this.taskNameEditor?.elementId
    if (!elementId) return
    const element = this.controllerInstance.getModel().elements.find(item => item.id === elementId)
    if (!element || !this.isEditableNameElement(element)) return
    const nextName = normalizeEditableName(value, this.resolveNameEditorFallback(element))
    if (this.resolveEditableNameValue(element) === nextName) return
    if (element.type === BPMN_PARTICIPANT_TYPE && this.taskNameEditor?.part?.partType === 'bpmn.swimlane.lane') {
      const participant = element as BpmnParticipantElement
      this.controllerInstance.applyCommand({
        type: 'element.replace',
        id: element.id,
        element: renameBpmnParticipantLane(participant, this.taskNameEditor.part.partId ?? '', nextName),
      })
      return
    }
    this.controllerInstance.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          name: nextName,
        },
      },
    })
  }

  private isTaskNameEditorPointer(point: ModelerPoint): boolean {
    const target = this.nova.events.hitTest(point.x, point.y)
    const targetId = target ? String((target as { componentId?: string }).componentId ?? target.id) : ''
    return targetId === this.taskNameEditorInputId() || targetId.startsWith(`${this.taskNameEditorInputId()}:`)
  }

  private containsTaskNamePoint(element: EditableNameElement, point: ModelerPoint, part?: EditableNamePart): boolean {
    if (element.type === BPMN_PARTICIPANT_TYPE && !part?.partType) return false
    const rect = this.resolveTaskNameContentRect(element, part)
    return point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height
  }

  private taskNameEditorInputId(): string {
    return `${this.componentId}:task-name-editor:input`
  }

  private isEditableNameElement(element: { type: string }): element is EditableNameElement {
    return element.type === BPMN_TASK_TYPE
      || element.type === BPMN_SUB_PROCESS_TYPE
      || element.type === BPMN_CALL_ACTIVITY_TYPE
      || element.type === BPMN_DATA_STORE_TYPE
      || element.type === BPMN_GROUP_TYPE
      || element.type === BPMN_PARTICIPANT_TYPE
  }

  private resolveNameEditorKind(element: EditableNameElement, part?: EditableNamePart): EditableNameKind {
    if (element.type === BPMN_PARTICIPANT_TYPE && part?.partType === 'bpmn.swimlane.lane') return 'lane'
    if (element.type === BPMN_PARTICIPANT_TYPE) return 'participant'
    if (element.type === BPMN_DATA_STORE_TYPE) return 'dataStore'
    if (element.type === BPMN_GROUP_TYPE) return 'group'
    if (element.type === BPMN_SUB_PROCESS_TYPE || element.type === BPMN_CALL_ACTIVITY_TYPE) return 'activity'
    return 'task'
  }

  private resolveNameEditorFallback(element: EditableNameElement): string {
    if (element.type === BPMN_PARTICIPANT_TYPE && this.taskNameEditor?.part?.partType === 'bpmn.swimlane.lane') return 'Lane'
    if (element.type === BPMN_PARTICIPANT_TYPE) return 'Participant'
    if (element.type === BPMN_DATA_STORE_TYPE) return 'Data store'
    if (element.type === BPMN_GROUP_TYPE) return 'Group'
    if (element.type === BPMN_SUB_PROCESS_TYPE) return 'Sub-process'
    if (element.type === BPMN_CALL_ACTIVITY_TYPE) return 'Call activity'
    return 'Task'
  }

  private resolveNameEditorAlign(element: EditableNameElement): 'left' | 'center' {
    return element.type === BPMN_GROUP_TYPE ? 'left' : 'center'
  }

  private resolveNameEditorTargetType(element: EditableNameElement): string {
    if (element.type === BPMN_PARTICIPANT_TYPE && this.taskNameEditor?.part?.partType === 'bpmn.swimlane.lane') return 'modeler.bpmn.participant.lane.name'
    if (element.type === BPMN_PARTICIPANT_TYPE) return 'modeler.bpmn.participant.name'
    if (element.type === BPMN_DATA_STORE_TYPE) return 'modeler.bpmn.data-store.name'
    if (element.type === BPMN_GROUP_TYPE) return 'modeler.bpmn.group.name'
    if (element.type === BPMN_SUB_PROCESS_TYPE) return 'modeler.bpmn.sub-process.name'
    if (element.type === BPMN_CALL_ACTIVITY_TYPE) return 'modeler.bpmn.call-activity.name'
    return 'modeler.bpmn.task.name'
  }

  private resolveEditableNameValue(element: EditableNameElement): string {
    if (element.type === BPMN_PARTICIPANT_TYPE && this.taskNameEditor?.part?.partType === 'bpmn.swimlane.lane') {
      const participant = element as BpmnParticipantElement
      const lane = participant.data?.lanes.find(item => item.id === this.taskNameEditor?.part?.partId)
      return lane?.name ?? this.resolveNameEditorFallback(element)
    }
    return element.data?.name ?? this.resolveNameEditorFallback(element)
  }

  private resolveHitTargetElementId(target: ModelerHitTarget): string | null {
    if (target.type === 'element') return target.id
    if (target.type === 'element-part') return target.id
    return null
  }

  private closeContextPadMenus(): void {
    const controls = this.layerSurfaces.get('controls')
    if (!controls) return
    const stack: Array<unknown> = [...controls.children]
    while (stack.length > 0) {
      const node = stack.shift()
      const descriptorType = (node as { descriptor?: { type?: string } }).descriptor?.type
      const componentId = (node as { componentId?: string }).componentId
      const children = (node as { children?: Array<unknown> }).children
      if (children?.length) stack.push(...children)
      if (descriptorType !== Modeler.ContextPad || !componentId) continue
      this.nova.components.api<ContextPadApi>(componentId)?.closeMenus()
    }
  }

  private setModelerCursorFromTarget(target: ModelerHitTarget): void {
    this.setModelerCursor(this.resolveModelerCursor(target))
  }

  private setModelerCursor(cursor: string): void {
    if (this.currentModelerCursor === cursor) return
    this.currentModelerCursor = cursor
    this.options({ cursorContext: { modelerCursor: cursor } })
  }

  private resolveModelerCursor(target: ModelerHitTarget): string {
    if (this.spacePressed || this.dragState) return 'pan'
    if (target.type === 'rotate-handle') return 'rotate'
    if (target.type === 'resize-handle') return this.resolveResizeCursor(target.handle)
    if (target.type === 'edge-waypoint-handle' || target.type === 'edge-segment-handle') return 'edge-handle'
    if (target.type === 'port') return 'port'
    if (target.type === 'element') return this.resolveElementCursor(target.id)
    if (target.type === 'element-part') return this.resolveElementCursor(target.id)
    return 'default'
  }

  private syncEdgeSegmentHover(target: ModelerHitTarget, point: ModelerPoint): void {
    if (this.activePluginGesture) {
      MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.clear()
      return
    }
    if (target.type !== 'edge-segment-handle' && target.type !== 'element' && target.type !== 'element-part') {
      MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.clear()
      return
    }
    const elementId = target.type === 'edge-segment-handle' ? target.elementId : target.id
    const model = this.controllerInstance.getModel()
    if ((target.type === 'element' || target.type === 'element-part') && !model.selection.includes(elementId)) {
      MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.clear()
      return
    }
    const element = model.elements.find(item => item.id === elementId)
    if (!element || !isModelerEdgeElement(element)) {
      MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.clear()
      return
    }
    const handle = MODEL_ELEMENTS_RUNTIME.edges.createSegmentHandleAtPoint(
      this.controllerInstance.getPluginContext(),
      element,
      this.controllerInstance.screenToWorld(point),
    )
    MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.set(handle)
  }

  private resolveElementCursor(elementId: string): string {
    const model = this.controllerInstance.getModel()
    const element = model.elements.find(item => item.id === elementId)
    const definition = element ? this.controllerInstance.getElementRegistry().get(element.type) : undefined
    if (element && isModelerEdgeElement(element)) return 'pointer'
    if (definition?.capabilities?.cursor?.hover === 'pointer') return 'pointer'
    if (definition?.capabilities?.cursor?.hover) return 'element'
    if (definition?.capabilities?.draggable === false) return 'default'
    return 'element'
  }

  private resolveResizeCursor(handle: string): string {
    if (handle === 'n' || handle === 's') return 'ns-resize'
    if (handle === 'e' || handle === 'w') return 'ew-resize'
    if (handle === 'ne' || handle === 'sw') return 'nesw-resize'
    return 'nwse-resize'
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

function normalizeEditableName(value: string, fallback: string): string {
  const next = value.trim()
  return next.length > 0 ? next : fallback
}
