import type { ModelerElementRegistry } from '@/domain/types/elements/element-registry.types'
import type { ModelerViewport } from '@/domain/types/model/geometry.types'
import type {
  ModelerModel,
  ModelerModelInput,
} from '@/domain/types/model/model.types'
import type {
  ModelerFeatureName,
  ModelerOptions,
  ModelerOptionsRef,
} from '@/domain/types/model/options.types'
import type { ModelerController } from '@/domain/types/plugins/controller.types'
import type { ModelerPlugin } from '@/domain/types/plugins/plugin.types'
import type { ModelerPluginRuntime } from '@/domain/types/plugins/plugin-runtime.types'

export interface ModelerRootProps {
  model: ModelerModel | ModelerModelInput
  width?: number
  height?: number
  options?: ModelerOptions | ModelerOptionsRef
  controller?: ModelerController
  elementRegistry?: ModelerElementRegistry
  pluginRuntime?: ModelerPluginRuntime
  features?: Partial<Record<ModelerFeatureName, boolean>>
  plugins?: Array<ModelerPlugin>
  pluginsVersion?: number
  onModelChange?: (model: ModelerModel) => void
  onSelectionChange?: (selection: Array<string>) => void
}

export interface ModelerRootResolvedProps {
  model: ModelerModel
  width: number
  height: number
  options: ModelerOptionsRef
  controller?: ModelerController
  elementRegistry?: ModelerElementRegistry
  pluginRuntime?: ModelerPluginRuntime
  features: Record<ModelerFeatureName, boolean>
  plugins: Array<ModelerPlugin>
  pluginsVersion: number
  onModelChange?: (model: ModelerModel) => void
  onSelectionChange?: (selection: Array<string>) => void
}

export interface ModelerRootApi {
  getModel(): ModelerModel
  setModel(model: ModelerModel | ModelerModelInput): void
  getViewport(): ModelerViewport
  setViewport(viewport: Partial<ModelerViewport>): ModelerModel
  fitView(): ModelerViewport
}
