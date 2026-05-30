import type {
  NovaNode,
  NovaSchema,
  NovaSurface,
  NovaTemplateChildSchema,
} from '@endge/nova'
import type { ModelerCommand } from '@/domain/types/command.types'
import type { ModelerOptions } from '@/domain/types/options.types'
import type {
  ModelerPoint,
  ModelerViewport,
} from '@/domain/types/geometry.types'
import type {
  ModelerHitTarget,
  ModelerLayout,
  ModelerModel,
} from '@/domain/types/model.types'
import type { ModelerLayerName } from '@/domain/types/layer.types'

export type ModelerStoreKey<T> = string | symbol | { id: string; __type?: T }

export interface ModelerPluginLayer {
  id: string
  order?: number
  render: (context: ModelerPluginContext) => NovaSchema
}

export interface ModelerLayerApi {
  add(layer: ModelerPluginLayer): () => void
  get(name: ModelerLayerName): NovaSurface<any>
  mount(name: ModelerLayerName, schema: NovaTemplateChildSchema): NovaNode<any>
  unmount(node: NovaNode<any>): void
  reconcile(name: ModelerLayerName, ownerId: string, schema: Array<NovaTemplateChildSchema>): () => void
}

export interface ModelerContextStore {
  provide<T>(key: ModelerStoreKey<T>, value: T): () => void
  inject<T>(key: ModelerStoreKey<T>): T | undefined
}

export interface ModelerContextModelApi {
  get(): ModelerModel
  set(model: ModelerModel): void
  update(updater: (model: ModelerModel) => ModelerModel): ModelerModel
  subscribe(listener: (model: ModelerModel) => void): () => void
}

export interface ModelerGesture {
  id: string
  priority?: number
  hitTest?: (context: ModelerPluginContext, event: MouseEvent, target: ModelerHitTarget) => boolean
  onPointerDown?: (context: ModelerPluginContext, event: MouseEvent) => false | void
  onPointerMove?: (context: ModelerPluginContext, event: MouseEvent) => false | void
  onPointerUp?: (context: ModelerPluginContext, event: MouseEvent) => false | void
  onCancel?: (context: ModelerPluginContext) => void
}

export interface ModelerPluginContext {
  model: ModelerContextModelApi
  store: ModelerContextStore
  getModel(): ModelerModel
  getLayout(): ModelerLayout
  getOptions(): ModelerOptions
  getViewport(): ModelerViewport
  setViewport(viewport: Partial<ModelerViewport>): ModelerModel
  applyCommand(command: ModelerCommand): ModelerModel
  hitTest(point: ModelerPoint): ModelerHitTarget
  screenToWorld(point: ModelerPoint): ModelerPoint
  worldToScreen(point: ModelerPoint): ModelerPoint
  invalidate(phase?: 'update' | 'render' | 'both'): void
  layers: ModelerLayerApi
  gestures: { add(gesture: ModelerGesture): () => void }
}

export interface ModelerPlugin {
  id: string
  setup(context: ModelerPluginContext): void | (() => void)
  dispose?(): void
}
