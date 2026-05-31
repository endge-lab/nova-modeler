import { PluginBase } from '@/model/plugin-runtime/PluginBase'
import type {
  ModelerElementDefinition,
  ModelerPoint,
} from '@/domain/types/index'
import { MODELER_ELEMENTS_PLUGIN_ID } from '@/plugins/elements/elements.constants'
import { ElementsGestures } from '@/plugins/elements/elements-gestures'
import { ElementsLayer } from '@/plugins/elements/elements-layer'
import {
  ElementsRuntime,
  MODEL_ELEMENTS_RUNTIME,
} from '@/plugins/elements/model/ElementsRuntime'

/**
 * Подключает graph layer элементов и общие gestures.
 */
export class ElementsPlugin extends PluginBase {
  readonly id = MODELER_ELEMENTS_PLUGIN_ID
  private readonly runtime: ElementsRuntime
  private layer: ElementsLayer | null = null
  private gestures: ElementsGestures | null = null
  private createCounter = 0

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
        this.publishElementCreateTool(definition, createTool)
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

  /**
   * Очищает локальные runtime-ссылки.
   */
  protected override onDispose(): void {
    this.layer?.dispose()
    this.gestures?.dispose()
    this.layer = null
    this.gestures = null
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
