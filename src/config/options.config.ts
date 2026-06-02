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
    snap: {
      enabled: true,
      disableModifier: 'alt',
    },
    selection: {
      multiple: true,
      additiveModifier: 'shift',
      toggleModifier: 'meta',
      marqueeModifier: 'shift',
      clearOnCanvasPointerDown: true,
      selectOnPointerDown: true,
      deleteShortcuts: [
        { key: 'Backspace', preventDefault: true },
        { key: 'Delete', preventDefault: true },
      ],
    },
    tools: {
      activeToolId: null,
    },
  },
  rendering: {
    bpmnRecipes: {
      enabled: true,
      mode: 'auto',
      lodScale: 0.35,
      nodes: true,
      edges: false,
      text: 'batch',
      culling: true,
      diagnostics: false,
    },
  },
  branding: {
    visible: true,
  },
  palette: {
    placement: 'left',
    draggable: true,
    offset: 16,
    itemSize: 40,
    gap: 8,
    padding: 8,
    gripSize: 32,
    groups: {
      tools: { dividerAfter: true },
      elements: {},
    },
  },
  shortcuts: {
    bindings: {},
  },
}

export function createDefaultModelerOptions(): ModelerOptions {
  return {
    ...DEFAULT_MODELER_OPTIONS,
    viewport: { ...DEFAULT_MODELER_OPTIONS.viewport },
    interaction: {
      ...DEFAULT_MODELER_OPTIONS.interaction,
      snap: DEFAULT_MODELER_OPTIONS.interaction?.snap === false
        ? false
        : { ...(DEFAULT_MODELER_OPTIONS.interaction?.snap ?? {}) },
      selection: {
        ...DEFAULT_MODELER_OPTIONS.interaction?.selection,
        deleteShortcuts: [...(DEFAULT_MODELER_OPTIONS.interaction?.selection?.deleteShortcuts ?? [])],
      },
      tools: { ...DEFAULT_MODELER_OPTIONS.interaction?.tools },
    },
    rendering: {
      ...DEFAULT_MODELER_OPTIONS.rendering,
      bpmnRecipes: { ...(DEFAULT_MODELER_OPTIONS.rendering?.bpmnRecipes ?? {}) },
    },
    palette: {
      ...DEFAULT_MODELER_OPTIONS.palette,
      visibleItemIds: DEFAULT_MODELER_OPTIONS.palette?.visibleItemIds
        ? [...DEFAULT_MODELER_OPTIONS.palette.visibleItemIds]
        : undefined,
      order: DEFAULT_MODELER_OPTIONS.palette?.order
        ? [...DEFAULT_MODELER_OPTIONS.palette.order]
        : undefined,
      placement: DEFAULT_MODELER_OPTIONS.palette?.placement,
      draggable: DEFAULT_MODELER_OPTIONS.palette?.draggable,
      offset: DEFAULT_MODELER_OPTIONS.palette?.offset,
      offsetX: DEFAULT_MODELER_OPTIONS.palette?.offsetX,
      offsetY: DEFAULT_MODELER_OPTIONS.palette?.offsetY,
      itemSize: DEFAULT_MODELER_OPTIONS.palette?.itemSize,
      gap: DEFAULT_MODELER_OPTIONS.palette?.gap,
      padding: DEFAULT_MODELER_OPTIONS.palette?.padding,
      gripSize: DEFAULT_MODELER_OPTIONS.palette?.gripSize,
      groups: { ...(DEFAULT_MODELER_OPTIONS.palette?.groups ?? {}) },
    },
    branding: {
      ...DEFAULT_MODELER_OPTIONS.branding,
    },
    shortcuts: {
      ...DEFAULT_MODELER_OPTIONS.shortcuts,
      bindings: { ...(DEFAULT_MODELER_OPTIONS.shortcuts?.bindings ?? {}) },
    },
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
      snap: options?.interaction?.snap === false
        ? false
        : {
            ...(defaults.interaction?.snap === false ? {} : defaults.interaction?.snap ?? {}),
            ...(options?.interaction?.snap ?? {}),
          },
      selection: {
        ...(defaults.interaction?.selection ?? {}),
        ...(options?.interaction?.selection ?? {}),
        deleteShortcuts: options?.interaction?.selection?.deleteShortcuts
          ? [...options.interaction.selection.deleteShortcuts]
          : [...(defaults.interaction?.selection?.deleteShortcuts ?? [])],
      },
      tools: {
        ...(defaults.interaction?.tools ?? {}),
        ...(options?.interaction?.tools ?? {}),
      },
    },
    rendering: {
      ...(defaults.rendering ?? {}),
      ...(options?.rendering ?? {}),
      bpmnRecipes: {
        ...(defaults.rendering?.bpmnRecipes ?? {}),
        ...(options?.rendering?.bpmnRecipes ?? {}),
      },
    },
    palette: {
      ...(defaults.palette ?? {}),
      ...(options?.palette ?? {}),
      visibleItemIds: options?.palette?.visibleItemIds
        ? [...options.palette.visibleItemIds]
        : defaults.palette?.visibleItemIds
          ? [...defaults.palette.visibleItemIds]
          : undefined,
      order: options?.palette?.order
        ? [...options.palette.order]
        : defaults.palette?.order
          ? [...defaults.palette.order]
          : undefined,
      groups: {
        ...(defaults.palette?.groups ?? {}),
        ...(options?.palette?.groups ?? {}),
      },
    },
    branding: {
      ...(defaults.branding ?? {}),
      ...(options?.branding ?? {}),
    },
    shortcuts: {
      ...(defaults.shortcuts ?? {}),
      ...(options?.shortcuts ?? {}),
      bindings: {
        ...(defaults.shortcuts?.bindings ?? {}),
        ...(options?.shortcuts?.bindings ?? {}),
      },
    },
  }
}
