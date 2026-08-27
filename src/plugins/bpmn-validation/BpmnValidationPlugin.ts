import type {
  ModelerModel,
  ModelerPlugin,
  ModelerPluginContext,
  ModelerStoreKey,
  ModelerValidationResult,
} from '@/domain/types/index'
import { BpmnValidationRuntime } from '@/model/validation/BpmnValidationRuntime'

export const BPMN_VALIDATION_RESULT_KEY: ModelerStoreKey<ModelerValidationResult> = {
  id: 'bpmn.validation.result',
}

export interface BpmnValidationPluginOptions {
  debounceMs?: number
  validate?: (model: ModelerModel) => ModelerValidationResult
}

export class BpmnValidationPlugin implements ModelerPlugin {
  static readonly ID = 'bpmn.validation'

  readonly id = BpmnValidationPlugin.ID

  private _context?: ModelerPluginContext
  private _disposeModelSubscription?: () => void
  private _disposeResult?: () => void
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined
  private _lastElementsVersion = Number.NaN
  private _lastModelId = ''
  private readonly _debounceMs: number
  private readonly _validateModel: (model: ModelerModel) => ModelerValidationResult

  constructor(options: BpmnValidationPluginOptions = {}) {
    this._debounceMs = Math.max(0, options.debounceMs ?? 150)
    this._validateModel = options.validate ?? BpmnValidationRuntime.validate
  }

  static create(options: BpmnValidationPluginOptions = {}): BpmnValidationPlugin {
    return new BpmnValidationPlugin(options)
  }

  setup(context: ModelerPluginContext): void {
    this._context = context
    const model = context.getModel()
    this._lastModelId = model.id
    this._lastElementsVersion = model.elementsVersion
    this._publish(this._validateModel(model))
    this._disposeModelSubscription = context.model.subscribe((nextModel) => {
      if (nextModel.id === this._lastModelId && nextModel.elementsVersion === this._lastElementsVersion) {
        return
      }
      this._lastModelId = nextModel.id
      this._lastElementsVersion = nextModel.elementsVersion
      this._schedule(nextModel)
    }, {
      includeViewport: false,
    })
  }

  dispose(): void {
    this._disposeModelSubscription?.()
    this._disposeModelSubscription = undefined
    this._disposeResult?.()
    this._disposeResult = undefined
    this._context = undefined
    this._clearTimer()
  }

  private _schedule(model: ModelerModel): void {
    this._clearTimer()
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = undefined
      this._publish(this._validateModel(model))
    }, this._debounceMs)
  }

  private _publish(result: ModelerValidationResult): void {
    if (!this._context) {
      return
    }
    this._disposeResult?.()
    this._disposeResult = this._context.store.provide(BPMN_VALIDATION_RESULT_KEY, result)
    this._context.invalidate('render')
  }

  private _clearTimer(): void {
    if (!this._debounceTimer) {
      return
    }
    clearTimeout(this._debounceTimer)
    this._debounceTimer = undefined
  }
}
