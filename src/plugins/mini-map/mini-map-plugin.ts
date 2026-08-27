import type { NovaNode } from '@endge/nova'
import type {
  MiniMapController,
  MiniMapControllerAdapter,
  MiniMapControllerOptions,
  MiniMapPluginOptions,
} from '@/plugins/mini-map/mini-map.types'
import { Modeler } from '@/config/schema.config'
import { PluginBase } from '@/model/plugin-runtime/PluginBase'

/**
 * Управляет внешним состоянием mini-map plugin.
 */
export class MiniMapControllerModule implements MiniMapController {
  private _visibleValue: boolean
  private readonly _adapters = new Set<MiniMapControllerAdapter>()

  constructor(private readonly _options: MiniMapControllerOptions = {}) {
    this._visibleValue = _options.visible ?? true
  }

  get visible(): boolean {
    return this._visibleValue
  }

  setVisible(visible: boolean): void {
    if (this._visibleValue === visible) {
      return
    }
    this._visibleValue = visible
    this._options.onVisibleChange?.(visible)
    this._adapters.forEach(adapter => adapter.invalidate())
  }

  toggle(): void {
    this.setVisible(!this._visibleValue)
  }

  __bind(adapter: MiniMapControllerAdapter): () => void {
    this._adapters.add(adapter)
    return () => this._adapters.delete(adapter)
  }
}

/**
 * Монтирует mini-map controls в controls layer.
 */
export class MiniMapPlugin extends PluginBase {
  readonly id: string
  private _node: NovaNode<any> | null = null
  private _disposeController: (() => void) | undefined

  constructor(private readonly _options: MiniMapPluginOptions = {}) {
    super()
    this.id = _options.id ?? 'mini-map'
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
    this._node = this.mount('controls', {
      type: Modeler.MiniMap,
      id: `${this.id}:node`,
      props: this._createNodeProps(),
    })
    this._disposeController = this._options.controller?.__bind({
      invalidate: () => this._syncNodeProps(),
    })
    if (this._disposeController) {
      this.addDisposer(this._disposeController)
    }
  }

  /**
   * Сбрасывает локальные ссылки.
   */
  protected onDispose(): void {
    this._node = null
    this._disposeController = undefined
  }

  /**
   * Синхронизирует props mounted node при изменении controller.
   */
  private _syncNodeProps(): void {
    const node = this._node as (NovaNode<any> & { setProps?: (patch: Record<string, unknown>) => unknown }) | null
    node?.setProps?.(this._createNodeProps())
  }

  /**
   * Собирает props для component node.
   */
  private _createNodeProps(): Record<string, unknown> {
    return {
      position: 'fixed',
      inset: { right: 16, bottom: 16 },
      visible: this._options.controller?.visible ?? this._options.visible ?? true,
      placement: this._options.placement,
      width: this._options.width,
      height: this._options.height,
      margin: this._options.margin,
      draggableViewport: this._options.draggableViewport,
    }
  }
}
