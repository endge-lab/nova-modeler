import type { ModelerModel } from '@/domain/types/model/model.types'
import type { ModelerPluginContext } from '@/domain/types/plugins/plugin.types'

export type ModelerExportFormat = 'bpmn' | 'png'

export interface ModelerExportFile {
  blob: Blob
  fileName: string
  mimeType: string
}

export interface ModelerExportOptions {
  fileName?: string
}

export interface ModelerPngExportOptions extends ModelerExportOptions {
  padding?: number
  scale?: number
  background?: string
}

export interface ModelerExportContext {
  model: ModelerModel
  pluginContext?: ModelerPluginContext
}
