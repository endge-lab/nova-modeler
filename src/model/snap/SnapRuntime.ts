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
  private readonly _gridStrategy = new GridSnapStrategy()
  private readonly _noopStrategy = new NoopSnapStrategy()

  constructor(private readonly _context: ModelerPluginContext) {}

  /**
   * Привязывает абсолютную позицию элемента.
   */
  moveElement(input: ModelerSnapMoveInput): { x: number, y: number } {
    if (!this._isEnabled(input.event)) {
      return input.raw
    }
    return this._resolveStrategy().snapPoint({
      point: input.raw,
      gridSize: this._resolveGridSize(),
      element: input.element,
    })
  }

  /**
   * Привязывает bounds resize-операции.
   */
  resizeElement(input: ModelerSnapRuntimeResizeInput): { x: number, y: number, width: number, height: number } {
    if (!this._isEnabled(input.event)) {
      return input.rawBounds
    }
    return this._resolveStrategy().snapResize({
      bounds: input.rawBounds,
      source: input.element,
      handle: input.handle,
      gridSize: this._resolveGridSize(),
      element: input.element,
      minSize: input.minSize,
    })
  }

  /**
   * Проверяет, активен ли snap для текущего события.
   */
  private _isEnabled(event?: MouseEvent): boolean {
    const options = this._resolveOptions()
    if (options === false) {
      return false
    }
    if (options.enabled === false) {
      return false
    }
    return !this._isDisabledByModifier(event, options.disableModifier ?? 'alt')
  }

  /**
   * Возвращает пользовательскую стратегию или grid-snap по умолчанию.
   */
  private _resolveStrategy(): ModelerSnapStrategy {
    const options = this._resolveOptions()
    if (options === false) {
      return this._noopStrategy
    }
    return options.strategy ?? this._gridStrategy
  }

  /**
   * Возвращает snap-настройки из interaction options.
   */
  private _resolveOptions(): false | ModelerSnapOptions {
    return this._context.getOptions().interaction?.snap ?? { enabled: true, disableModifier: 'alt' }
  }

  /**
   * Возвращает world-grid size независимо от render LOD сетки.
   */
  private _resolveGridSize(): number {
    return this._context.getOptions().interaction?.gridSize
      ?? this._context.getModel().canvas.gridSize
  }

  /**
   * Проверяет временное отключение snap через modifier key.
   */
  private _isDisabledByModifier(event: MouseEvent | undefined, modifier: ModelerSnapDisableModifier): boolean {
    if (!event || modifier === 'none') {
      return false
    }
    if (modifier === 'alt') {
      return event.altKey
    }
    if (modifier === 'meta') {
      return event.metaKey
    }
    if (modifier === 'shift') {
      return event.shiftKey
    }
    return event.ctrlKey
  }
}
