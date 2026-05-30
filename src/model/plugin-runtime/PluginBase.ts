import type {
  NovaNode,
  NovaTemplateChildSchema,
} from '@endge/nova'
import type {
  ModelerLayerName,
  ModelerPlugin,
  ModelerPluginContext,
} from '@/domain/types/index'

/**
 * Базовый класс feature-плагина Modeler.
 */
export abstract class PluginBase implements ModelerPlugin {
  abstract readonly id: string

  protected context!: ModelerPluginContext
  private readonly disposers: Array<() => void> = []
  private nodeId = 0

  /**
   * Подключает plugin к host-контексту моделлера.
   */
  setup(context: ModelerPluginContext): void {
    this.context = context
    this.onSetup()
  }

  /**
   * Отключает plugin и очищает все зарегистрированные ресурсы.
   */
  dispose(): void {
    for (const dispose of this.disposers.splice(0)) dispose()
    this.onDispose()
  }

  /**
   * Выполняет plugin-specific подключение.
   */
  protected abstract onSetup(): void

  /**
   * Выполняет plugin-specific cleanup после common disposers.
   */
  protected onDispose(): void {}

  /**
   * Регистрирует disposer, который будет вызван при отключении plugin.
   */
  protected addDisposer(dispose: () => void): void {
    this.disposers.push(dispose)
  }

  /**
   * Монтирует node в выбранный layer и автоматически снимает ее при dispose.
   */
  protected mount(layer: ModelerLayerName, schema: NovaTemplateChildSchema): NovaNode<any> {
    const node = this.context.layers.mount(layer, {
      ...schema,
      id: schema.id ?? `${this.id}:${layer}:${this.nextNodeId()}`,
    })
    this.addDisposer(() => node.remove())
    return node
  }

  /**
   * Монтирует несколько nodes в разные слои.
   */
  protected mountMany(items: Array<{ layer: ModelerLayerName; schema: NovaTemplateChildSchema }>): Array<NovaNode<any>> {
    return items.map(item => this.mount(item.layer, item.schema))
  }

  /**
   * Реконсайлит owner-owned template внутри layer.
   */
  protected reconcile(layer: ModelerLayerName, schemas: Array<NovaTemplateChildSchema>): void {
    this.addDisposer(this.context.layers.reconcile(layer, this.id, schemas))
  }

  /**
   * Возвращает следующий локальный id для mounted node.
   */
  private nextNodeId(): number {
    this.nodeId += 1
    return this.nodeId
  }
}
