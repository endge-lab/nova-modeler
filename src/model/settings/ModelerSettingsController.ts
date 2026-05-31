import {
  MODELER_SETTINGS_DIALOG_TYPE,
  type ModelerSettingsControllerOptions,
  type ModelerSettingsDialogPayload,
} from '@/domain/types/index'

/**
 * Управляет открытием package-level диалога настроек Modeler.
 */
export class ModelerSettingsController {
  private readonly rootResolver: ModelerSettingsControllerOptions['root']
  private readonly type: string
  private readonly id: string

  /**
   * Создает controller поверх Root dialog API из Nova UI Kit.
   */
  constructor(options: ModelerSettingsControllerOptions) {
    this.rootResolver = options.root
    this.type = options.type ?? MODELER_SETTINGS_DIALOG_TYPE
    this.id = options.id ?? this.type
  }

  /**
   * Открывает диалог и заменяет payload текущим снимком настроек.
   */
  open(payload: ModelerSettingsDialogPayload = {}): string | null {
    return this.rootResolver()?.openDialog({
      ...payload,
      id: this.id,
      type: this.type,
    }) ?? null
  }

  /**
   * Закрывает диалог настроек.
   */
  close(event?: Event): void {
    this.rootResolver()?.closeDialog(this.id, event)
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
    if (!this.isOpen()) return
    this.rootResolver()?.updateDialog(this.id, payload)
  }

  /**
   * Проверяет, открыт ли диалог настроек.
   */
  isOpen(): boolean {
    return this.rootResolver()?.getOpenDialogIds().includes(this.id) ?? false
  }
}

/**
 * Создает controller диалога настроек Modeler.
 */
export function createModelerSettingsController(options: ModelerSettingsControllerOptions): ModelerSettingsController {
  return new ModelerSettingsController(options)
}
