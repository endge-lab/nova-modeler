import type { ModelerOptions } from '@/domain/types/model/options.types'
import type { ModelerViewport } from '@/domain/types/model/geometry.types'
import type {
  ModelerLayout,
  ModelerModel,
} from '@/domain/types/model/model.types'

export type ModelerLayerName = 'background' | 'links' | 'interaction' | 'controls' | 'overlay'

export interface ModelerLayerSlotProps {
  model: ModelerModel
  layout: ModelerLayout
  viewport: ModelerViewport
  options: ModelerOptions
}
