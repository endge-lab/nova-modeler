import type {
  ModelerPluginContext,
  ModelerSnapDisableModifier,
  ModelerSnapMoveInput,
  ModelerSnapOptions,
  ModelerSnapRuntimeResizeInput,
  ModelerSnapStrategy,
} from '@/domain/types/index'
import { GridSnapStrategy } from '@/model/snap/GridSnapStrategy'
import { NoopSnapStrategy } from '@/model/snap/NoopSnapStrategy'

/**
 * Применяет пользовательскую snap-стратегию к интеракциям элементов.
 */
export class SnapRuntime {
  private readonly gridStrategy = new GridSnapStrategy()
  private readonly noopStrategy = new NoopSnapStrategy()

  constructor(private readonly context: ModelerPluginContext) {}

  /**
   * Привязывает абсолютную позицию элемента.
   */
  moveElement(input: ModelerSnapMoveInput): { x: number; y: number } {
    if (!this.isEnabled(input.event)) return input.raw
    return this.resolveStrategy().snapPoint({
      point: input.raw,
      gridSize: this.resolveGridSize(),
      element: input.element,
    })
  }

  /**
   * Привязывает bounds resize-операции.
   */
  resizeElement(input: ModelerSnapRuntimeResizeInput): { x: number; y: number; width: number; height: number } {
    if (!this.isEnabled(input.event)) return input.rawBounds
    return this.resolveStrategy().snapResize({
      bounds: input.rawBounds,
      source: input.element,
      handle: input.handle,
      gridSize: this.resolveGridSize(),
      element: input.element,
      minSize: input.minSize,
    })
  }

  /**
   * Проверяет, активен ли snap для текущего события.
   */
  private isEnabled(event?: MouseEvent): boolean {
    const options = this.resolveOptions()
    if (options === false) return false
    if (options.enabled === false) return false
    return !this.isDisabledByModifier(event, options.disableModifier ?? 'alt')
  }

  /**
   * Возвращает пользовательскую стратегию или grid-snap по умолчанию.
   */
  private resolveStrategy(): ModelerSnapStrategy {
    const options = this.resolveOptions()
    if (options === false) return this.noopStrategy
    return options.strategy ?? this.gridStrategy
  }

  /**
   * Возвращает snap-настройки из interaction options.
   */
  private resolveOptions(): false | ModelerSnapOptions {
    return this.context.getOptions().interaction?.snap ?? { enabled: true, disableModifier: 'alt' }
  }

  /**
   * Возвращает world-grid size независимо от render LOD сетки.
   */
  private resolveGridSize(): number {
    return this.context.getOptions().interaction?.gridSize
      ?? this.context.getModel().canvas.gridSize
  }

  /**
   * Проверяет временное отключение snap через modifier key.
   */
  private isDisabledByModifier(event: MouseEvent | undefined, modifier: ModelerSnapDisableModifier): boolean {
    if (!event || modifier === 'none') return false
    if (modifier === 'alt') return event.altKey
    if (modifier === 'meta') return event.metaKey
    if (modifier === 'shift') return event.shiftKey
    return event.ctrlKey
  }
}
