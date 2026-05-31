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
  private readonly bpmnExporter = new BpmnExporter()
  private readonly pngExporter = new ModelerPngExporter()

  constructor(private readonly context: ModelerPluginContext) {}

  /**
   * Формирует BPMN 2.0 файл для текущей модели.
   */
  exportBpmn(options: ModelerExportOptions = {}): ModelerExportFile {
    const model = this.context.getModel()
    return {
      blob: this.bpmnExporter.exportBlob({ model, pluginContext: this.context }),
      fileName: options.fileName ?? `${toFileStem(model.id)}.bpmn`,
      mimeType: 'application/xml;charset=utf-8',
    }
  }

  /**
   * Формирует PNG файл с tight bounds элементов текущей модели.
   */
  async exportPng(options: ModelerPngExportOptions = {}): Promise<ModelerExportFile> {
    const model = this.context.getModel()
    return {
      blob: await this.pngExporter.export({ model, pluginContext: this.context }, options),
      fileName: options.fileName ?? `${toFileStem(model.id)}.png`,
      mimeType: 'image/png',
    }
  }
}

function toFileStem(value: string): string {
  const stem = value.trim().replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '')
  return stem || 'nova-modeler'
}
