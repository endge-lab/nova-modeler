import type { NovaNode } from '@endge/nova'
import type {
  MarqueeSelectionController,
  MarqueeSelectionControllerAdapter,
  MarqueeSelectionControllerOptions,
  MarqueeSelectionPluginOptions,
} from '@/plugins/marquee-selection/marquee-selection.types'
import { Modeler } from '@/config/schema.config'
import { PluginBase } from '@/model/plugin-runtime/PluginBase'

/**
 * Управляет внешним состоянием marquee selection plugin.
 */
export class MarqueeSelectionControllerModule implements MarqueeSelectionController {
  private _enabledValue: boolean
  private readonly _adapters = new Set<MarqueeSelectionControllerAdapter>()

  constructor(private readonly _options: MarqueeSelectionControllerOptions = {}) {
    this._enabledValue = _options.enabled ?? true
  }

  get enabled(): boolean {
    return this._enabledValue
  }

  setEnabled(enabled: boolean): void {
    if (this._enabledValue === enabled) {
      return
    }
    this._enabledValue = enabled
    this._options.onEnabledChange?.(enabled)
    this._adapters.forEach(adapter => adapter.invalidate())
  }

  toggle(): void {
    this.setEnabled(!this._enabledValue)
  }

  __bind(adapter: MarqueeSelectionControllerAdapter): () => void {
    this._adapters.add(adapter)
    return () => this._adapters.delete(adapter)
  }
}

/**
 * Монтирует marquee selection в interaction layer.
 */
export class MarqueeSelectionPlugin extends PluginBase {
  readonly id: string
  private _node: NovaNode<any> | null = null
  private _disposeController: (() => void) | undefined

  constructor(private readonly _options: MarqueeSelectionPluginOptions = {}) {
    super()
    this.id = _options.id ?? 'marquee-selection'
  }

  /**
   * Создает marquee selection plugin instance.
   */
  static create(options: MarqueeSelectionPluginOptions = {}): MarqueeSelectionPlugin {
    return new MarqueeSelectionPlugin(options)
  }

  /**
   * Создает controller для внешнего управления marquee selection.
   */
  static createController(options: MarqueeSelectionControllerOptions = {}): MarqueeSelectionController {
    return new MarqueeSelectionControllerModule(options)
  }

  /**
   * Подключает marquee selection component и controller bridge.
   */
  protected onSetup(): void {
    this.addDisposer(this.context.tools.register({
      id: 'marqueeSelection',
      kind: 'mode',
      title: 'Rectangular selection',
      oneShot: true,
    }))
    this.addDisposer(this.context.palette.register({
      id: 'marqueeSelection.tool',
      kind: 'tool',
      group: 'tools',
      order: 10,
      title: 'Rectangular selection',
      icon: 'marquee-rect',
      toolId: 'marqueeSelection',
    }))
    this.addDisposer(this.context.shortcuts.register({
      id: 'marqueeSelection.activate',
      title: 'Rectangular selection',
      toolId: 'marqueeSelection',
      defaults: [{ key: 'm' }],
      scope: 'canvas',
    }))
    this._node = this.mount('interaction', {
      type: Modeler.MarqueeSelection,
      id: `${this.id}:node`,
      props: this._createNodeProps(),
    })
    this._disposeController = this._options.controller?.__bind({
      invalidate: () => this._syncNodeProps(),
      onSelectionComplete: ids => this._options.onSelectionComplete?.(ids),
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
      enabled: this._options.controller?.enabled ?? this._options.enabled ?? true,
      minDragPx: this._options.minDragPx,
      onSelectionComplete: this._options.onSelectionComplete,
    }
  }
}
