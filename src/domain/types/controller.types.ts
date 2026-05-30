import type {
  NovaNode,
  NovaSurface,
  NovaTemplateChildSchema,
} from '@endge/nova'
import type { ModelerOptions, ModelerOptionsRef } from '@/domain/types/options.types'
import type { ModelerCommand } from '@/domain/types/command.types'
import type {
  ModelerPoint,
  ModelerViewport,
} from '@/domain/types/geometry.types'
import type {
  ModelerHitTarget,
  ModelerLayout,
  ModelerModel,
  ModelerModelInput,
} from '@/domain/types/model.types'
import type { ModelerLayerName } from '@/domain/types/layer.types'
import type {
  ModelerGesture,
  ModelerPlugin,
  ModelerPluginContext,
  ModelerPluginLayer,
} from '@/domain/types/plugin.types'
import type { ModelerPluginRuntime } from '@/domain/types/plugin-runtime.types'

export interface ControllerOptions {
  model?: ModelerModel | ModelerModelInput
  options?: ModelerOptions | ModelerOptionsRef
  pluginRuntime?: ModelerPluginRuntime
  plugins?: Array<ModelerPlugin>
  onModelChange?: (model: ModelerModel) => void
  onSelectionChange?: (selection: Array<string>) => void
}

export interface ControllerHost {
  width: number
  height: number
  invalidate(phase?: 'update' | 'render' | 'both'): void
  onModelCommit(previous: ModelerModel, next: ModelerModel): void
  layers: {
    get(name: ModelerLayerName): NovaSurface<any>
    mount(name: ModelerLayerName, schema: NovaTemplateChildSchema): NovaNode<any>
    unmount(node: NovaNode<any>): void
    reconcile(name: ModelerLayerName, ownerId: string, schema: Array<NovaTemplateChildSchema>): () => void
  }
}

export interface ModelerController {
  mount(host: ControllerHost): void
  unmount(): void
  configure(options: ControllerOptions): void
  resize(width: number, height: number): void
  use(plugin: ModelerPlugin): this
  unuse(pluginOrId: ModelerPlugin | string): this
  getModel(): ModelerModel
  setModel(model: ModelerModel | ModelerModelInput): ModelerModel
  applyCommand(command: ModelerCommand): ModelerModel
  getViewport(): ModelerViewport
  setViewport(viewport: Partial<ModelerViewport>): ModelerModel
  fitView(): ModelerViewport
  getLayout(): ModelerLayout
  getOptions(): ModelerOptions
  getPluginContext(): ModelerPluginContext
  getPluginLayers(): ReadonlyArray<ModelerPluginLayer>
  getGestures(): ReadonlyArray<ModelerGesture>
  hitTest(point: ModelerPoint): ModelerHitTarget
  screenToWorld(point: ModelerPoint): ModelerPoint
  worldToScreen(point: ModelerPoint): ModelerPoint
  invalidate(phase?: 'update' | 'render' | 'both'): void
}
