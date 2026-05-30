import type { ModelerViewport } from '@/domain/types/geometry.types'
import type {
  ModelerModel,
  ModelerModelInput,
} from '@/domain/types/model.types'
import type {
  ModelerFeatureName,
  ModelerOptions,
  ModelerOptionsRef,
} from '@/domain/types/options.types'
import type { ModelerPlugin } from '@/domain/types/plugin.types'
import type { ModelerController } from '@/domain/types/controller.types'
import type { ModelerPluginRuntime } from '@/domain/types/plugin-runtime.types'

export interface ModelerRootProps {
  model: ModelerModel | ModelerModelInput
  width?: number
  height?: number
  options?: ModelerOptions | ModelerOptionsRef
  controller?: ModelerController
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
