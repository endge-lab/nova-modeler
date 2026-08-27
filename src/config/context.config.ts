import type {
  ModelerController,
  ModelerPluginContext,
  ModelerStore,
} from '@/domain/types/index'
import { Nova } from '@endge/nova'

export const MODELER_STORE = Nova.createContextToken<ModelerStore>('ModelerStore')
export const MODELER_CONTROLLER = Nova.createContextToken<ModelerController>('ModelerController')
export const MODELER_CONTEXT = Nova.createContextToken<ModelerPluginContext>('ModelerContext')
