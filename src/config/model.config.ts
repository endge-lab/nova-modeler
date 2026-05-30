import type {
  ModelerCanvas,
  ModelerViewport,
} from '@/domain/types/index'

export const DEFAULT_MODELER_CANVAS: ModelerCanvas = {
  x: -12000,
  y: -8000,
  width: 24000,
  height: 16000,
  gridSize: 32,
}

export const DEFAULT_MODELER_VIEWPORT: ModelerViewport = {
  x: 0,
  y: 0,
  scale: 1,
}
