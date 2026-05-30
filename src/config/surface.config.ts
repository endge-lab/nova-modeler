import type { ModelerLayerName } from '@/domain/types/index'

export const MODELER_SURFACE_CONFIG: Record<ModelerLayerName, {
  name: ModelerLayerName
  zIndex: number
  interactive: boolean
}> = {
  background: {
    name: 'background',
    zIndex: -1000,
    interactive: false,
  },
  interaction: {
    name: 'interaction',
    zIndex: 100,
    interactive: false,
  },
  controls: {
    name: 'controls',
    zIndex: 1000,
    interactive: false,
  },
  overlay: {
    name: 'overlay',
    zIndex: 2000,
    interactive: false,
  },
}

export const MODELER_LAYER_NAMES: Array<ModelerLayerName> = [
  'background',
  'interaction',
  'controls',
  'overlay',
]
