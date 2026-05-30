import type {
  ModelerOptions,
  ModelerOptionsRef,
} from '@/domain/types/index'

export const DEFAULT_MODELER_OPTIONS: ModelerOptions = {
  version: 0,
  viewport: {
    minZoom: 0.1,
    maxZoom: 3,
    zoomStep: 0.2,
    wheelZoomSpeed: 1.6,
    panMode: 'both',
  },
  interaction: {
    readonly: false,
    gridSize: 32,
  },
}

export function createDefaultModelerOptions(): ModelerOptions {
  return {
    ...DEFAULT_MODELER_OPTIONS,
    viewport: { ...DEFAULT_MODELER_OPTIONS.viewport },
    interaction: { ...DEFAULT_MODELER_OPTIONS.interaction },
  }
}

export function normalizeModelerOptions(options?: ModelerOptions | ModelerOptionsRef): ModelerOptionsRef {
  const current = options && typeof options === 'object' && 'current' in options
    ? mergeModelerOptions(options.current)
    : mergeModelerOptions(options)
  return {
    current,
    version: options && typeof options === 'object' && 'version' in options
      ? options.version ?? current.version ?? 0
      : current.version ?? 0,
  }
}

function mergeModelerOptions(options?: ModelerOptions): ModelerOptions {
  const defaults = createDefaultModelerOptions()
  return {
    ...defaults,
    ...(options ?? {}),
    viewport: {
      ...defaults.viewport,
      ...(options?.viewport ?? {}),
    },
    interaction: {
      ...defaults.interaction,
      ...(options?.interaction ?? {}),
    },
  }
}
