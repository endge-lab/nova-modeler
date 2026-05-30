import type { NovaNode } from '@endge/nova'
import { Modeler } from '@/config/schema.config'
import { PluginBase } from '@/model/plugin-runtime/PluginBase'
import type {
  MiniMapController,
  MiniMapControllerAdapter,
  MiniMapControllerOptions,
  MiniMapPluginOptions,
} from '@/plugins/mini-map/mini-map.types'

/**
 * Управляет внешним состоянием mini-map plugin.
 */
export class MiniMapControllerModule implements MiniMapController {
  private visibleValue: boolean
  private readonly adapters = new Set<MiniMapControllerAdapter>()

  constructor(private readonly options: MiniMapControllerOptions = {}) {
    this.visibleValue = options.visible ?? true
  }

  get visible(): boolean {
    return this.visibleValue
  }

  setVisible(visible: boolean): void {
    if (this.visibleValue === visible) return
    this.visibleValue = visible
    this.options.onVisibleChange?.(visible)
    this.adapters.forEach(adapter => adapter.invalidate())
  }

  toggle(): void {
    this.setVisible(!this.visibleValue)
  }

  __bind(adapter: MiniMapControllerAdapter): () => void {
    this.adapters.add(adapter)
    return () => this.adapters.delete(adapter)
  }
}

/**
 * Монтирует mini-map controls в controls layer.
 */
export class MiniMapPlugin extends PluginBase {
  readonly id: string
  private node: NovaNode<any> | null = null
  private disposeController: (() => void) | undefined

  constructor(private readonly options: MiniMapPluginOptions = {}) {
    super()
    this.id = options.id ?? 'mini-map'
  }

  /**
   * Создает mini-map plugin instance.
   */
  static create(options: MiniMapPluginOptions = {}): MiniMapPlugin {
    return new MiniMapPlugin(options)
  }

  /**
   * Создает controller для внешнего управления mini-map.
   */
  static createController(options: MiniMapControllerOptions = {}): MiniMapController {
    return new MiniMapControllerModule(options)
  }

  /**
   * Подключает mini-map component к controls layer.
   */
  protected onSetup(): void {
    this.node = this.mount('controls', {
      type: Modeler.MiniMap,
      id: `${this.id}:node`,
      props: this.createNodeProps(),
    })
    this.disposeController = this.options.controller?.__bind({
      invalidate: () => this.syncNodeProps(),
    })
    if (this.disposeController) this.addDisposer(this.disposeController)
  }

  /**
   * Сбрасывает локальные ссылки.
   */
  protected onDispose(): void {
    this.node = null
    this.disposeController = undefined
  }

  /**
   * Синхронизирует props mounted node при изменении controller.
   */
  private syncNodeProps(): void {
    const node = this.node as (NovaNode<any> & { setProps?: (patch: Record<string, unknown>) => unknown }) | null
    node?.setProps?.(this.createNodeProps())
  }

  /**
   * Собирает props для component node.
   */
  private createNodeProps(): Record<string, unknown> {
    return {
      position: 'fixed',
      inset: { right: 16, bottom: 16 },
      visible: this.options.controller?.visible ?? this.options.visible ?? true,
      placement: this.options.placement,
      width: this.options.width,
      height: this.options.height,
      margin: this.options.margin,
      draggableViewport: this.options.draggableViewport,
    }
  }
}
