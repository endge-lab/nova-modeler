import type {
  ModelerExportFile,
  ModelerExportOptions,
  ModelerPluginContext,
  ModelerPngExportOptions,
} from '@/domain/types/index'
import { BpmnExporter } from '@/model/export/BpmnExporter'
import { ModelerPngExporter } from '@/model/export/ModelerPngExporter'

/**
 * Единая прикладная точка экспорта модели в файлы.
 */
export class ModelerExportService {
  private readonly _bpmnExporter = new BpmnExporter()
  private readonly _pngExporter = new ModelerPngExporter()

  constructor(private readonly _context: ModelerPluginContext) {}

  /**
   * Формирует BPMN 2.0 файл для текущей модели.
   */
  exportBpmn(options: ModelerExportOptions = {}): ModelerExportFile {
    const model = this._context.getModel()
    return {
      blob: this._bpmnExporter.exportBlob({ model, pluginContext: this._context }),
      fileName: options.fileName ?? `${toFileStem(model.id)}.bpmn`,
      mimeType: 'application/xml;charset=utf-8',
    }
  }

  /**
   * Формирует PNG файл с tight bounds элементов текущей модели.
   */
  async exportPng(options: ModelerPngExportOptions = {}): Promise<ModelerExportFile> {
    const model = this._context.getModel()
    return {
      blob: await this._pngExporter.export({ model, pluginContext: this._context }, options),
      fileName: options.fileName ?? `${toFileStem(model.id)}.png`,
      mimeType: 'image/png',
    }
  }
}

function toFileStem(value: string): string {
  const stem = value.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
  return stem || 'nova-modeler'
}
