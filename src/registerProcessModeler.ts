import type { NovaSchemaRegistry } from '@endge/nova'
import { registerNovaUIKit } from '@endge/nova-ui-kit'
import { registerProcessModelerRoot } from '@/ui/root/process-modeler-root.registry'

/** Регистрирует ProcessModeler и базовые NovaUIKit primitives в Nova schema registry. */
export function registerProcessModeler(registry: NovaSchemaRegistry): void {
  registerNovaUIKit(registry)
  registerProcessModelerRoot(registry)
}
