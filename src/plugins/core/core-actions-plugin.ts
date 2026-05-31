import { PluginBase } from '@/model/plugin-runtime/PluginBase'

export class CoreActionsPlugin extends PluginBase {
  static readonly ID = 'modeler-core-actions'
  readonly id = CoreActionsPlugin.ID

  static create(): CoreActionsPlugin {
    return new CoreActionsPlugin()
  }

  protected onSetup(): void {
    this.addDisposer(this.context.actions.register({
      id: 'selection.delete',
      title: 'Delete selected elements',
      run: context => {
        const ids = context.getModel().selection
        if (ids.length === 0) return
        context.applyCommand({ type: 'element.deleteMany', ids })
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
}
