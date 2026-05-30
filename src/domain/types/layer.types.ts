import type { ModelerOptions } from '@/domain/types/options.types'
import type { ModelerViewport } from '@/domain/types/geometry.types'
import type {
  ModelerLayout,
  ModelerModel,
} from '@/domain/types/model.types'

export type ModelerLayerName = 'background' | 'interaction' | 'controls' | 'overlay'

export interface ModelerLayerSlotProps {
  model: ModelerModel
  layout: ModelerLayout
  viewport: ModelerViewport
  options: ModelerOptions
}
