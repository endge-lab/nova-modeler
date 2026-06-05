import type {
  NovaApp,
  NovaNode,
  NovaSurface,
  NovaTemplateChildSchema,
} from '@endge/nova'
import type { ModelerElementRegistry } from '@/domain/types/elements/element-registry.types'
import type { ModelerCommand } from '@/domain/types/command.types'
import type { ModelerOptions, ModelerOptionsRef } from '@/domain/types/model/options.types'
import type {
  ModelerPoint,
  ModelerViewport,
} from '@/domain/types/model/geometry.types'
import type {
  ModelerLayout,
  ModelerModel,
  ModelerModelInput,
} from '@/domain/types/model/model.types'
import type { ModelerHitTarget } from '@/domain/types/interaction/hit-target.types'
import type { ModelerLayerName } from '@/domain/types/plugins/layer.types'
import type {
  ModelerGesture,
  ModelerPlugin,
  ModelerPluginContext,
  ModelerPluginLayer,
  ModelerCommitMeta,
} from '@/domain/types/plugins/plugin.types'
import type { ModelerPluginRuntime } from '@/domain/types/plugins/plugin-runtime.types'
import type { ModelerStore } from '@/domain/types/model/store.types'

export interface ControllerOptions {
  model?: ModelerModel | ModelerModelInput
  store?: ModelerStore
  options?: ModelerOptions | ModelerOptionsRef
  elementRegistry?: ModelerElementRegistry
  pluginRuntime?: ModelerPluginRuntime
  plugins?: Array<ModelerPlugin>
  onModelChange?: (model: ModelerModel) => void
  onSelectionChange?: (selection: Array<string>) => void
}

export interface ControllerHost {
  id: string
  app: NovaApp<any>
  width: number
  height: number
  invalidate(phase?: 'update' | 'render' | 'both'): void
  onModelCommit(previous: ModelerModel, next: ModelerModel, meta: ModelerCommitMeta): void
  layers: {
    get(name: ModelerLayerName): NovaSurface<any>
    mount(name: ModelerLayerName, schema: NovaTemplateChildSchema): NovaNode<any>
    unmount(node: NovaNode<any>): void
    reconcile(name: ModelerLayerName, ownerId: string, schema: Array<NovaTemplateChildSchema>): () => void
  }
}

export interface ModelerController {
  readonly store: ModelerStore
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
  getElementRegistry(): ModelerElementRegistry
  getPluginContext(): ModelerPluginContext
  getPluginLayers(): ReadonlyArray<ModelerPluginLayer>
  getGestures(): ReadonlyArray<ModelerGesture>
  hitTest(point: ModelerPoint): ModelerHitTarget
  screenToWorld(point: ModelerPoint): ModelerPoint
  worldToScreen(point: ModelerPoint): ModelerPoint
  invalidate(phase?: 'update' | 'render' | 'both'): void
}
