import type { ModelerPluginContext } from '@/domain/types'
import { BrowserDownloadAdapter } from '@/model/export/BrowserDownloadAdapter'
import { ModelerExportService } from '@/model/export/ModelerExportService'
import { PluginBase } from '@/model/plugin-runtime/PluginBase'

export class CoreActionsPlugin extends PluginBase {
  static readonly ID = 'modeler-core-actions'
  readonly id = CoreActionsPlugin.ID
  private readonly _downloadAdapter = new BrowserDownloadAdapter()

  static create(): CoreActionsPlugin {
    return new CoreActionsPlugin()
  }

  protected onSetup(): void {
    this.addDisposer(this.context.actions.register({
      id: 'selection.delete',
      title: 'Delete selected elements',
      run: (context) => {
        const ids = context.getModel().selection
        if (ids.length === 0) {
          return
        }
        context.applyCommand({ type: 'element.deleteMany', ids })
      },
    }))
    this.addDisposer(this.context.actions.register({
      id: 'modeler.export.bpmn',
      title: 'Export BPMN',
      run: (context) => {
        const file = new ModelerExportService(context).exportBpmn()
        this._downloadAdapter.download(file.blob, file.fileName)
      },
    }))
    this.addDisposer(this.context.actions.register({
      id: 'modeler.export.png',
      title: 'Export PNG',
      run: (context) => {
        void this._downloadPng(context)
      },
    }))
    this.addDisposer(this.context.shortcuts.register({
      id: 'selection.delete',
      title: 'Delete selected elements',
      actionId: 'selection.delete',
      defaults: [
        { key: 'Backspace', preventDefault: true },
        { key: 'Delete', preventDefault: true },
      ],
      scope: 'canvas',
    }))
  }

  private async _downloadPng(context: ModelerPluginContext): Promise<void> {
    const file = await new ModelerExportService(context).exportPng()
    this._downloadAdapter.download(file.blob, file.fileName)
  }
}
