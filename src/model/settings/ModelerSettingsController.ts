import type { ModelerSettingsControllerOptions, ModelerSettingsDialogPayload } from '@/domain/types/index'
import {
  MODELER_SETTINGS_DIALOG_TYPE,

} from '@/domain/types/index'

/**
 * Управляет открытием package-level диалога настроек Modeler.
 */
export class ModelerSettingsController {
  private readonly _rootResolver: ModelerSettingsControllerOptions['root']
  private readonly _type: string
  private readonly _id: string

  /**
   * Создает controller поверх Root dialog API из Nova UI Kit.
   */
  constructor(options: ModelerSettingsControllerOptions) {
    this._rootResolver = options.root
    this._type = options.type ?? MODELER_SETTINGS_DIALOG_TYPE
    this._id = options.id ?? this._type
  }

  /**
   * Открывает диалог и заменяет payload текущим снимком настроек.
   */
  open(payload: ModelerSettingsDialogPayload = {}): string | null {
    return this._rootResolver()?.openDialog({
      ...payload,
      id: this._id,
      type: this._type,
    }) ?? null
  }

  /**
   * Закрывает диалог настроек.
   */
  close(event?: Event): void {
    this._rootResolver()?.closeDialog(this._id, event)
  }

  /**
   * Переключает открытое состояние диалога.
   */
  toggle(payload: ModelerSettingsDialogPayload = {}, event?: Event): string | null {
    if (this.isOpen()) {
      this.close(event)
      return null
    }

    return this.open(payload)
  }

  /**
   * Обновляет payload открытого диалога без пересоздания definition.
   */
  update(payload: ModelerSettingsDialogPayload): void {
    if (!this.isOpen()) {
      return
    }
    this._rootResolver()?.updateDialog(this._id, payload)
  }

  /**
   * Проверяет, открыт ли диалог настроек.
   */
  isOpen(): boolean {
    return this._rootResolver()?.getOpenDialogIds().includes(this._id) ?? false
  }
}

/**
 * Создает controller диалога настроек Modeler.
 */
export function createModelerSettingsController(options: ModelerSettingsControllerOptions): ModelerSettingsController {
  return new ModelerSettingsController(options)
}
