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
  containers: {
    name: 'containers',
    zIndex: -100,
    interactive: false,
  },
  links: {
    name: 'links',
    zIndex: 0,
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
  'containers',
  'links',
  'interaction',
  'controls',
  'overlay',
]
