import type { NovaApp, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import { getDefaultProcessPorts } from '@/model/ports/process-ports'
import type {
  ProcessNodeKind,
  ProcessPortDefinition,
} from '@/model/types/process-modeler.types'
import {
  createBuiltinProcessElementNode,
  type ProcessElementNode,
} from '@/ui/elements/ProcessElementNode'

export interface ProcessElementDefinition<E extends EventList = Record<string, any>> {
  kind: ProcessNodeKind
  label: string
  ports: Array<ProcessPortDefinition>
  createNode: (app: NovaApp<E>, surface: NovaSurface<E>) => ProcessElementNode<E>
}

/** Registry визуальных process elements и их default ports. */
export class ProcessElementCatalog<E extends EventList = Record<string, any>> {
  private readonly definitions = new Map<ProcessNodeKind, ProcessElementDefinition<E>>()

  /** Регистрирует или заменяет definition элемента. */
  register(definition: ProcessElementDefinition<E>): this {
    this.definitions.set(definition.kind, {
      ...definition,
      ports: definition.ports.map(port => ({ ...port, metadata: { ...port.metadata } })),
    })
    return this
  }

  /** Возвращает definition элемента. */
  get(kind: ProcessNodeKind): ProcessElementDefinition<E> | undefined {
    return this.definitions.get(kind)
  }

  /** Требует definition элемента. */
  require(kind: ProcessNodeKind): ProcessElementDefinition<E> {
    const definition = this.get(kind)
    if (!definition) throw new Error(`Process element "${kind}" is not registered.`)
    return definition
  }

  /** Создает NovaNode instance для визуального элемента. */
  createNode(kind: ProcessNodeKind, app: NovaApp<E>, surface: NovaSurface<E>): ProcessElementNode<E> {
    return this.require(kind).createNode(app, surface)
  }

  /** Возвращает все definitions в порядке регистрации. */
  all(): Array<ProcessElementDefinition<E>> {
    return Array.from(this.definitions.values())
  }
}

/** Создает пустой catalog process elements. */
export function createProcessElementCatalog<E extends EventList = Record<string, any>>(): ProcessElementCatalog<E> {
  return new ProcessElementCatalog<E>()
}

/** Регистрирует element definition в catalog. */
export function registerProcessElement<E extends EventList = Record<string, any>>(catalog: ProcessElementCatalog<E>, definition: ProcessElementDefinition<E>): ProcessElementCatalog<E> {
  return catalog.register(definition)
}

/** Возвращает catalog встроенных BPMN-like элементов. */
export function getBuiltinProcessElementCatalog<E extends EventList = Record<string, any>>(): ProcessElementCatalog<E> {
  const catalog = createProcessElementCatalog<E>()
  for (const item of BUILTIN_ELEMENT_ITEMS) {
    catalog.register({
      ...item,
      ports: getDefaultProcessPorts(item.kind),
      createNode: (app, surface) => createBuiltinProcessElementNode(item.kind, app, surface),
    })
  }
  return catalog
}

const BUILTIN_ELEMENT_ITEMS: Array<{ kind: ProcessNodeKind; label: string }> = [
  { kind: 'startEvent', label: 'Start' },
  { kind: 'userTask', label: 'User task' },
  { kind: 'serviceTask', label: 'Service' },
  { kind: 'exclusiveGateway', label: 'Exclusive' },
  { kind: 'parallelGateway', label: 'Parallel' },
  { kind: 'endEvent', label: 'End' },
]
