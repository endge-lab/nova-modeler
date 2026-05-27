import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { ProcessModeler } from '@/process-modeler'
import { createProcessModel } from '@/model/store/process-model'
import type {
  ProcessModelerRootApi,
  ProcessModelerRootProps,
  ProcessModelerRootResolvedProps,
} from '@/model/types/process-modeler.types'

export type ProcessModelerRootDescriptor = NovaComponentDescriptor<
  ProcessModelerRootResolvedProps,
  ProcessModelerRootApi,
  Record<string, never>,
  ProcessModelerRootProps
>

export type ProcessModelerRootNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<ProcessModelerRootProps>,
) => NovaComponentNode<ProcessModelerRootResolvedProps, ProcessModelerRootApi, Record<string, never>, ProcessModelerRootProps, E>

export const PROCESS_MODELER_ROOT_FIELD_DEFINITIONS = {
  model: { type: 'record' },
  width: { type: 'number' },
  height: { type: 'number' },
  paletteWidth: { type: 'number' },
  inspectorWidth: { type: 'number' },
  readonly: { type: 'boolean' },
  onModelChange: { type: 'function' },
  onSelectionChange: { type: 'function' },
  onValidationChange: { type: 'function' },
} as const

/** Нормализует props root-компонента ProcessModeler. */
export function normalizeProcessModelerRootProps(props: ProcessModelerRootProps = {}): ProcessModelerRootResolvedProps {
  return {
    model: createProcessModel(props.model),
    width: props.width ?? 1280,
    height: props.height ?? 720,
    paletteWidth: props.paletteWidth ?? 188,
    inspectorWidth: props.inspectorWidth ?? 252,
    readonly: props.readonly ?? false,
    onModelChange: props.onModelChange,
    onSelectionChange: props.onSelectionChange,
    onValidationChange: props.onValidationChange,
  }
}

/** Создает descriptor root-компонента ProcessModeler. */
export function createProcessModelerRootDescriptor(createNode?: ProcessModelerRootNodeFactory): ProcessModelerRootDescriptor {
  const descriptor: ProcessModelerRootDescriptor = {
    type: ProcessModeler.Root,
    name: 'ProcessModelerRoot',
    title: 'Process Modeler Root',
    version: '0.1.0',
    kind: 'node-component',
    dirtyPolicy: {
      update: ['model', 'width', 'height', 'paletteWidth', 'inspectorWidth'],
      render: ['readonly', 'onModelChange', 'onSelectionChange', 'onValidationChange'],
    },
    fields: PROCESS_MODELER_ROOT_FIELD_DEFINITIONS,
    normalize: schema => normalizeProcessModelerRootProps(schema.props),
    measureBounds: (_context, schema) => {
      const props = normalizeProcessModelerRootProps(schema.props)
      return { x: 0, y: 0, width: props.width, height: props.height }
    },
  }

  if (createNode) descriptor.createNode = createNode
  return descriptor
}

export const PROCESS_MODELER_ROOT_NODE_DESCRIPTOR = createProcessModelerRootDescriptor()
