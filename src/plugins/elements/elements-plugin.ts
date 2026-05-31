import { PluginBase } from '@/model/plugin-runtime/PluginBase'
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
    this.layer = new ElementsLayer(this.context, this.runtime)
    this.gestures = new ElementsGestures(this.context, this.runtime)
    this.layer.sync()
    this.addDisposer(this.context.model.subscribe(() => this.layer?.sync()))
    this.gestures.bind(dispose => this.addDisposer(dispose))
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
