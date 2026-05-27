import type { NovaSchemaRegistry } from '@endge/nova'
import { ProcessModelerRoot } from '@/ui/root/ProcessModelerRoot'
import {
  createProcessModelerRootDescriptor,
  normalizeProcessModelerRootProps,
  type ProcessModelerRootDescriptor,
} from '@/ui/root/process-modeler-root.config'
import type { ProcessModelerRootProps } from '@/model/types/process-modeler.types'

export const PROCESS_MODELER_ROOT_DESCRIPTOR: ProcessModelerRootDescriptor = createProcessModelerRootDescriptor((context, schema) => {
  return new ProcessModelerRoot(
    context.app,
    context.surface,
    normalizeProcessModelerRootProps(schema.props as ProcessModelerRootProps),
    { componentId: schema.id },
    PROCESS_MODELER_ROOT_DESCRIPTOR,
  )
})

/** Регистрирует root-компонент ProcessModeler. */
export function registerProcessModelerRoot(registry: { register: (descriptor: ProcessModelerRootDescriptor, options?: { override?: boolean }) => void }): void {
  registry.register(PROCESS_MODELER_ROOT_DESCRIPTOR, { override: true })
}

/** Регистрирует root schema ProcessModeler в Nova registry. */
export function registerProcessModelerRootSchema(registry: NovaSchemaRegistry): void {
  registerProcessModelerRoot(registry)
}
