import { Nova } from '@endge/nova'
import type {
  ModelerController,
  ModelerPluginContext,
} from '@/domain/types/index'

export const MODELER_CONTROLLER = Nova.createContextToken<ModelerController>('ModelerController')
export const MODELER_CONTEXT = Nova.createContextToken<ModelerPluginContext>('ModelerContext')
