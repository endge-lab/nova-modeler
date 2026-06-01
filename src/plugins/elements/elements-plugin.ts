import { PluginBase } from '@/model/plugin-runtime/PluginBase'
import type {
  ModelerElement,
  ModelerEdgeElement,
  ModelerElementDefinition,
  ModelerPoint,
  ModelerPluginContext,
} from '@/domain/types/index'
import { BPMN_TEXT_ANNOTATION_TYPE } from '@/elements/bpmn/artifacts/text-annotation/bpmn-text-annotation.factory'
import { BPMN_DATA_OBJECT_TYPE } from '@/elements/bpmn/data/data-object/bpmn-data-object.factory'
import { BPMN_DATA_STORE_TYPE } from '@/elements/bpmn/data/data-store/bpmn-data-store.factory'
import { BPMN_EVENT_TYPE } from '@/elements/bpmn/event/bpmn-event.factory'
import { BPMN_GATEWAY_TYPE } from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import { BPMN_SUB_PROCESS_TYPE } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import { BPMN_TASK_TYPE } from '@/elements/bpmn/task/bpmn-task.factory'
import type { ElementsConnectionEdgeInput } from '@/plugins/elements/model/ElementsConnectionFlow'
import { MODELER_ELEMENTS_PLUGIN_ID } from '@/plugins/elements/elements.constants'
import { ElementsGestures } from '@/plugins/elements/elements-gestures'
import { ElementsLayer } from '@/plugins/elements/elements-layer'
import {
  ElementsRuntime,
  MODEL_ELEMENTS_RUNTIME,
} from '@/plugins/elements/model/ElementsRuntime'
import { eventPoint } from '@/tools/event-point'

/**
 * Подключает graph layer элементов и общие gestures.
 */
export class ElementsPlugin extends PluginBase {
  readonly id = MODELER_ELEMENTS_PLUGIN_ID
  private readonly runtime: ElementsRuntime
  private layer: ElementsLayer | null = null
  private gestures: ElementsGestures | null = null
  private createCounter = 0
  private readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    const activeToolId = this.context.tools.getActiveId()
    if (!this.isConnectionToolId(activeToolId) && !this.runtime.connection.get()) return
    event.preventDefault()
    this.runtime.connectionFlow.clear()
    this.context.tools.deactivate(activeToolId ?? undefined)
  }

  constructor(runtime: ElementsRuntime = MODEL_ELEMENTS_RUNTIME) {
    super()
    this.runtime = runtime
  }

  /**
   * Создает plugin для graph elements.
   */
  static create(): ElementsPlugin {
    return new ElementsPlugin()
  }

  /**
   * Подключает rendering layer и gestures.
   */
  protected onSetup(): void {
    this.publishElementCreateTools()
    this.publishConnectTool()
    this.setupWindowEvents()
    this.layer = new ElementsLayer(this.context, this.runtime)
    this.gestures = new ElementsGestures(this.context, this.runtime)
    this.layer.sync()
    this.addDisposer(this.context.model.subscribe(() => this.layer?.sync()))
    this.gestures.bind(dispose => this.addDisposer(dispose))
  }

  private publishElementCreateTools(): void {
    for (const definition of this.context.getElementRegistry().getAll()) {
      if (definition.variantProvider) {
        this.addDisposer(this.context.elementVariants.register(definition.variantProvider))
      }
      const createTools = [
        ...(definition.createTool ? [definition.createTool] : []),
        ...(definition.createTools ?? []),
      ]
      for (const createTool of createTools) {
        if (definition.kind === 'edge') this.publishEdgeCreateTool(definition, createTool)
        else this.publishElementCreateTool(definition, createTool)
      }
    }
  }

  private publishElementCreateTool(
    definition: ModelerElementDefinition,
    createTool: NonNullable<ModelerElementDefinition['createTool']>,
  ): void {
    const toolId = createTool.id ?? `create:${definition.type}`
    const actionId = createTool.actionId ?? `element.create.${definition.type}`
    const paletteId = createTool.palette?.id ?? `${definition.type}.create`
    const shortcutId = createTool.shortcutId ?? paletteId
    this.addDisposer(this.context.actions.register({
      id: actionId,
      title: createTool.title,
      run: context => {
        context.tools.activate(toolId)
      },
    }))
    this.addDisposer(this.context.tools.register({
      id: toolId,
      kind: 'create-element',
      title: createTool.title,
      tooltip: createTool.tooltip ?? createTool.palette?.tooltip,
      oneShot: true,
      createAt: (_context, point) => this.createElementAt(definition, createTool, point),
    }))
    this.addDisposer(this.context.palette.register({
      id: paletteId,
      kind: 'tool',
      group: createTool.palette?.group ?? 'elements',
      order: createTool.palette?.order ?? 100,
      title: createTool.palette?.title ?? createTool.title,
      tooltip: createTool.palette?.tooltip ?? createTool.tooltip,
      icon: createTool.palette?.icon ?? definition.type,
      toolId,
    }))
    this.addDisposer(this.context.shortcuts.register({
      id: shortcutId,
      title: createTool.title,
      toolId,
      defaults: createTool.shortcuts ?? [],
      scope: 'canvas',
    }))
  }

  private publishEdgeCreateTool(
    definition: ModelerElementDefinition,
    createTool: NonNullable<ModelerElementDefinition['createTool']>,
  ): void {
    const actionId = createTool.actionId ?? `element.create.${definition.type}`
    const paletteId = createTool.palette?.id ?? `${definition.type}.create`
    const shortcutId = createTool.shortcutId ?? paletteId
    const toolId = createTool.id?.startsWith('connect:')
      ? createTool.id
      : `connect:${definition.type}`
    const idPrefix = definition.type.replace(/[^a-z0-9]+/gi, '-')
    const edgeFactory = {
      idPrefix,
      previewId: `${idPrefix}-preview`,
      create: (input: ElementsConnectionEdgeInput) => createTool.create(input) as ModelerEdgeElement,
      canStart: this.createEdgeCanStart(definition.type),
      canComplete: this.createEdgeCanComplete(definition.type),
    }
    this.addDisposer(this.context.actions.register({
      id: actionId,
      title: createTool.title,
      run: context => {
        this.runtime.connectionFlow.useEdgeFactory(edgeFactory)
        context.tools.activate(toolId)
      },
    }))
    this.addDisposer(this.context.tools.register({
      id: toolId,
      kind: 'mode',
      title: createTool.title,
      tooltip: createTool.tooltip ?? createTool.palette?.tooltip,
      oneShot: false,
      activate: () => {
        this.runtime.connectionFlow.useEdgeFactory(edgeFactory)
      },
      deactivate: () => {
        this.runtime.connectionFlow.clear()
        this.runtime.connectionFlow.resetEdgeFactory()
      },
      onCancel: () => {
        this.runtime.connectionFlow.clear()
      },
      onPointerMove: (context, event) => this.updateConnectionPreview(context, event),
    }))
    this.addDisposer(this.context.palette.register({
      id: paletteId,
      kind: 'tool',
      group: createTool.palette?.group ?? 'tools',
      order: createTool.palette?.order ?? 100,
      title: createTool.palette?.title ?? createTool.title,
      tooltip: createTool.palette?.tooltip ?? createTool.tooltip,
      icon: createTool.palette?.icon ?? definition.type,
      toolId,
    }))
    this.addDisposer(this.context.shortcuts.register({
      id: shortcutId,
      title: createTool.title,
      toolId,
      defaults: createTool.shortcuts ?? [],
      scope: 'canvas',
    }))
  }

  private publishConnectTool(): void {
    this.addDisposer(this.context.actions.register({
      id: 'element.connect',
      title: 'Connect elements',
      run: context => {
        this.runtime.connectionFlow.useDefaultEdgeFactory()
        context.tools.activate('connect')
      },
    }))
    this.addDisposer(this.context.actions.register({
      id: 'element.connect.from-selection',
      title: 'Connect from selected element',
      run: context => {
        const sourceId = context.getModel().selection[0]
        if (!sourceId) return
        this.runtime.connectionFlow.useDefaultEdgeFactory()
        context.tools.activate('connect')
        this.beginConnectionFromElement(context, sourceId, 'context-pad')
      },
    }))
    this.addDisposer(this.context.tools.register({
      id: 'connect',
      kind: 'mode',
      title: 'Connect',
      tooltip: 'Connect elements',
      oneShot: false,
      activate: () => {
        this.runtime.connectionFlow.useDefaultEdgeFactory()
      },
      deactivate: () => {
        this.runtime.connectionFlow.clear()
        this.runtime.connectionFlow.resetEdgeFactory()
      },
      onCancel: () => {
        this.runtime.connectionFlow.clear()
      },
      onPointerMove: (context, event) => this.updateConnectionPreview(context, event),
    }))
    this.addDisposer(this.context.palette.register({
      id: 'element.connect.tool',
      kind: 'tool',
      group: 'tools',
      order: 20,
      title: 'Connect',
      tooltip: 'Connect elements',
      icon: 'connect-arrow',
      toolId: 'connect',
    }))
    this.addDisposer(this.context.shortcuts.register({
      id: 'element.connect',
      title: 'Connect elements',
      actionId: 'element.connect',
      defaults: [{ key: 'c' }],
      scope: 'canvas',
    }))
  }

  private createElementAt(
    definition: ModelerElementDefinition,
    createTool: NonNullable<ModelerElementDefinition['createTool']>,
    point: ModelerPoint,
  ) {
    const width = finiteNumber(definition.defaults?.width, 48)
    const height = finiteNumber(definition.defaults?.height, 48)
    const id = `${definition.type.replace(/[^a-z0-9]+/gi, '-')}-${Date.now().toString(36)}-${this.createCounter += 1}`
    const element = createTool.create({
      id,
      x: Math.round(point.x - width / 2),
      y: Math.round(point.y - height / 2),
    })
    this.context.applyCommand({ type: 'element.add', element })
    this.context.applyCommand({ type: 'select', ids: [element.id] })
    return element
  }

  private beginConnectionFromElement(
    context: ModelerPluginContext,
    elementId: string,
    origin: 'tool' | 'context-pad',
    referencePoint?: ModelerPoint,
  ): boolean {
    return this.runtime.connectionFlow.beginFromElement(context, elementId, origin, referencePoint)
  }

  private updateConnectionPreview(context: ModelerPluginContext, event: MouseEvent): void {
    const state = this.runtime.connection.get()
    if (!state) return
    const screen = eventPoint(event)
    this.runtime.connectionFlow.updatePreviewToPoint(
      context,
      context.screenToWorld(screen),
      context.hitTest(screen),
    )
  }

  private createEdgeCanStart(type: string): ((context: ModelerPluginContext, element: ModelerElement) => boolean) | undefined {
    if (type !== 'bpmn.association') return undefined
    return (_context, element) => isAssociationNode(element)
  }

  private createEdgeCanComplete(type: string): ((context: ModelerPluginContext, source: ModelerElement, target: ModelerElement) => boolean) | undefined {
    if (type !== 'bpmn.association') return undefined
    return (_context, source, target) => isAssociationNode(source) && isAssociationNode(target)
  }

  private isConnectionToolId(toolId: string | null): boolean {
    return toolId === 'connect' || toolId?.startsWith('connect:') === true
  }

  /**
   * Очищает локальные runtime-ссылки.
   */
  protected override onDispose(): void {
    this.teardownWindowEvents()
    this.layer?.dispose()
    this.gestures?.dispose()
    this.layer = null
    this.gestures = null
  }

  private setupWindowEvents(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('keydown', this.handleWindowKeyDown, true)
    this.addDisposer(() => this.teardownWindowEvents())
  }

  private teardownWindowEvents(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('keydown', this.handleWindowKeyDown, true)
  }
}

function isAssociationNode(element: ModelerElement): boolean {
  return element.type === BPMN_EVENT_TYPE
    || element.type === BPMN_GATEWAY_TYPE
    || element.type === BPMN_TASK_TYPE
    || element.type === BPMN_SUB_PROCESS_TYPE
    || element.type === BPMN_CALL_ACTIVITY_TYPE
    || element.type === BPMN_TEXT_ANNOTATION_TYPE
    || element.type === BPMN_DATA_OBJECT_TYPE
    || element.type === BPMN_DATA_STORE_TYPE
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
