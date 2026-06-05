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

  private context?: ModelerPluginContext
  private disposeModelSubscription?: () => void
  private disposeResult?: () => void
  private debounceTimer: ReturnType<typeof setTimeout> | undefined
  private lastElementsVersion = Number.NaN
  private lastModelId = ''
  private readonly debounceMs: number
  private readonly validateModel: (model: ModelerModel) => ModelerValidationResult

  constructor(options: BpmnValidationPluginOptions = {}) {
    this.debounceMs = Math.max(0, options.debounceMs ?? 150)
    this.validateModel = options.validate ?? BpmnValidationRuntime.validate
  }

  static create(options: BpmnValidationPluginOptions = {}): BpmnValidationPlugin {
    return new BpmnValidationPlugin(options)
  }

  setup(context: ModelerPluginContext): void {
    this.context = context
    const model = context.getModel()
    this.lastModelId = model.id
    this.lastElementsVersion = model.elementsVersion
    this.publish(this.validateModel(model))
    this.disposeModelSubscription = context.model.subscribe(nextModel => {
      if (nextModel.id === this.lastModelId && nextModel.elementsVersion === this.lastElementsVersion) return
      this.lastModelId = nextModel.id
      this.lastElementsVersion = nextModel.elementsVersion
      this.schedule(nextModel)
    }, {
      includeViewport: false,
    })
  }

  dispose(): void {
    this.disposeModelSubscription?.()
    this.disposeModelSubscription = undefined
    this.disposeResult?.()
    this.disposeResult = undefined
    this.context = undefined
    this.clearTimer()
  }

  private schedule(model: ModelerModel): void {
    this.clearTimer()
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined
      this.publish(this.validateModel(model))
    }, this.debounceMs)
  }

  private publish(result: ModelerValidationResult): void {
    if (!this.context) return
    this.disposeResult?.()
    this.disposeResult = this.context.store.provide(BPMN_VALIDATION_RESULT_KEY, result)
    this.context.invalidate('render')
  }

  private clearTimer(): void {
    if (!this.debounceTimer) return
    clearTimeout(this.debounceTimer)
    this.debounceTimer = undefined
  }
}
