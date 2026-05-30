import type { NovaNode } from '@endge/nova'
import { Modeler } from '@/config/schema.config'
import { PluginBase } from '@/model/plugin-runtime/PluginBase'
import type {
  MarqueeSelectionController,
  MarqueeSelectionControllerAdapter,
  MarqueeSelectionControllerOptions,
  MarqueeSelectionPluginOptions,
} from '@/plugins/marquee-selection/marquee-selection.types'

/**
 * Управляет внешним состоянием marquee selection plugin.
 */
export class MarqueeSelectionControllerModule implements MarqueeSelectionController {
  private enabledValue: boolean
  private readonly adapters = new Set<MarqueeSelectionControllerAdapter>()

  constructor(private readonly options: MarqueeSelectionControllerOptions = {}) {
    this.enabledValue = options.enabled ?? true
  }

  get enabled(): boolean {
    return this.enabledValue
  }

  setEnabled(enabled: boolean): void {
    if (this.enabledValue === enabled) return
    this.enabledValue = enabled
    this.options.onEnabledChange?.(enabled)
    this.adapters.forEach(adapter => adapter.invalidate())
  }

  toggle(): void {
    this.setEnabled(!this.enabledValue)
  }

  __bind(adapter: MarqueeSelectionControllerAdapter): () => void {
    this.adapters.add(adapter)
    return () => this.adapters.delete(adapter)
  }
}

/**
 * Монтирует marquee selection в interaction layer.
 */
export class MarqueeSelectionPlugin extends PluginBase {
  readonly id: string
  private node: NovaNode<any> | null = null
  private disposeController: (() => void) | undefined

  constructor(private readonly options: MarqueeSelectionPluginOptions = {}) {
    super()
    this.id = options.id ?? 'marquee-selection'
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
    this.node = this.mount('interaction', {
      type: Modeler.MarqueeSelection,
      id: `${this.id}:node`,
      props: this.createNodeProps(),
    })
    this.disposeController = this.options.controller?.__bind({
      invalidate: () => this.syncNodeProps(),
      onSelectionComplete: ids => this.options.onSelectionComplete?.(ids),
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
      enabled: this.options.controller?.enabled ?? this.options.enabled ?? true,
      minDragPx: this.options.minDragPx,
      onSelectionComplete: this.options.onSelectionComplete,
    }
  }
}
