import type {
  ProcessCommand,
  ProcessElementId,
  ProcessMetadata,
  ProcessModel,
  ProcessModelInput,
  ProcessNode,
} from '@/model/types/process-modeler.types'
import {
  cloneProcessModel,
  createProcessElementId,
  createProcessModel,
  findProcessEdge,
  findProcessLane,
  findProcessNode,
  findProcessPool,
  hasProcessElement,
  normalizeEdge,
  normalizeMetadata,
  normalizeNode,
  normalizeViewport,
} from '@/model/store/process-model'

/** Хранит process-модель и применяет редактирующие команды с undo/redo. */
export class ProcessModelStore {
  private model: ProcessModel
  private readonly undoStack: Array<ProcessModel> = []
  private readonly redoStack: Array<ProcessModel> = []

  /** Создает store с нормализованной моделью. */
  constructor(model?: ProcessModelInput | ProcessModel) {
    this.model = createProcessModel(model)
  }

  /** Возвращает копию текущей модели. */
  getModel(): ProcessModel {
    return cloneProcessModel(this.model)
  }

  /** Заменяет текущую модель и очищает redo. */
  setModel(model: ProcessModelInput | ProcessModel, record = true): ProcessModel {
    if (record) this.pushUndo()
    this.model = createProcessModel(model)
    this.redoStack.length = 0
    return this.getModel()
  }

  /** Применяет команду редактирования. */
  applyCommand(command: ProcessCommand, record = true): ProcessModel {
    if (record) this.pushUndo()

    switch (command.type) {
      case 'addNode':
        this.addNode(command.node, command.select ?? true)
        break
      case 'moveNode':
        this.moveNode(command.id, command.dx, command.dy)
        break
      case 'connect':
        this.connect(command.id ?? createProcessElementId('flow'), command.sourceId, command.targetId, command.sourcePortId, command.targetPortId, command.metadata, command.select ?? true)
        break
      case 'delete':
        this.deleteElements(command.ids)
        break
      case 'select':
        this.select(command.ids, command.mode ?? 'replace')
        break
      case 'updateMetadata':
        this.updateMetadata(command.id, command.metadata)
        break
      case 'setViewport':
        this.model = { ...this.model, viewport: normalizeViewport({ ...this.model.viewport, ...command.viewport }) }
        break
      case 'setModel':
        this.model = createProcessModel(command.model)
        break
      default:
        exhaustive(command)
    }

    this.redoStack.length = 0
    return this.getModel()
  }

  /** Откатывает последнюю команду. */
  undo(): ProcessModel {
    const previous = this.undoStack.pop()
    if (!previous) return this.getModel()
    this.redoStack.push(cloneProcessModel(this.model))
    this.model = previous
    return this.getModel()
  }

  /** Повторяет откатанную команду. */
  redo(): ProcessModel {
    const next = this.redoStack.pop()
    if (!next) return this.getModel()
    this.undoStack.push(cloneProcessModel(this.model))
    this.model = next
    return this.getModel()
  }

  /** Возвращает количество undo/redo snapshot. */
  historyState(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    }
  }

  private addNode(node: Partial<ProcessNode> & Pick<ProcessNode, 'id' | 'kind' | 'x' | 'y'>, select: boolean): void {
    const normalized = normalizeNode(node)
    this.model = {
      ...this.model,
      nodes: upsertById(this.model.nodes, normalized),
      selection: select ? [normalized.id] : this.model.selection,
    }
  }

  private moveNode(id: string, dx: number, dy: number): void {
    this.model = {
      ...this.model,
      nodes: this.model.nodes.map(node => node.id === id ? { ...node, x: node.x + dx, y: node.y + dy } : node),
    }
  }

  private connect(id: string, sourceId: string, targetId: string, sourcePortId: string | undefined, targetPortId: string | undefined, metadata: ProcessMetadata | undefined, select: boolean): void {
    const existing = this.model.edges.find(edge => edge.id === id)
    const edge = normalizeEdge({
      id,
      sourceId,
      targetId,
      sourcePortId: sourcePortId ?? existing?.sourcePortId,
      targetPortId: targetPortId ?? existing?.targetPortId,
      metadata,
    })
    this.model = {
      ...this.model,
      edges: upsertById(this.model.edges, edge),
      selection: select ? [edge.id] : this.model.selection,
    }
  }

  private deleteElements(ids: Array<ProcessElementId>): void {
    const idSet = new Set(ids)
    this.model = {
      ...this.model,
      nodes: this.model.nodes.filter(node => !idSet.has(node.id)),
      edges: this.model.edges.filter(edge => !idSet.has(edge.id) && !idSet.has(edge.sourceId) && !idSet.has(edge.targetId)),
      pools: this.model.pools
        .filter(pool => !idSet.has(pool.id))
        .map(pool => ({ ...pool, lanes: pool.lanes.filter(lane => !idSet.has(lane.id)) })),
      selection: this.model.selection.filter(id => !idSet.has(id)),
    }
  }

  private select(ids: Array<ProcessElementId>, mode: 'replace' | 'append' | 'toggle'): void {
    const validIds = ids.filter(id => hasProcessElement(this.model, id))
    const current = new Set(mode === 'replace' ? [] : this.model.selection)

    for (const id of validIds) {
      if (mode === 'toggle' && current.has(id)) current.delete(id)
      else current.add(id)
    }

    this.model = { ...this.model, selection: Array.from(current) }
  }

  private updateMetadata(id: string, metadata: ProcessMetadata): void {
    const patch = normalizeMetadata(metadata)
    this.model = {
      ...this.model,
      metadata: this.model.id === id ? { ...this.model.metadata, ...patch } : this.model.metadata,
      nodes: this.model.nodes.map(node => node.id === id ? { ...node, metadata: { ...node.metadata, ...patch } } : node),
      edges: this.model.edges.map(edge => edge.id === id ? { ...edge, metadata: { ...edge.metadata, ...patch } } : edge),
      pools: this.model.pools.map(pool => {
        if (pool.id === id) return { ...pool, metadata: { ...pool.metadata, ...patch } }
        return {
          ...pool,
          lanes: pool.lanes.map(lane => lane.id === id ? { ...lane, metadata: { ...lane.metadata, ...patch } } : lane),
        }
      }),
    }
  }

  private pushUndo(): void {
    this.undoStack.push(cloneProcessModel(this.model))
    if (this.undoStack.length > 100) this.undoStack.shift()
  }
}

/** Создает store для process modeler. */
export function createProcessModelStore(model?: ProcessModelInput | ProcessModel): ProcessModelStore {
  return new ProcessModelStore(model)
}

/** Возвращает публичный элемент модели по id. */
export function findProcessElement(model: ProcessModel, id: string): ProcessNode | ReturnType<typeof findProcessEdge> | ReturnType<typeof findProcessLane> | ReturnType<typeof findProcessPool> {
  return findProcessNode(model, id) ?? findProcessEdge(model, id) ?? findProcessLane(model, id) ?? findProcessPool(model, id)
}

function upsertById<T extends { id: string }>(items: Array<T>, item: T): Array<T> {
  const index = items.findIndex(current => current.id === item.id)
  if (index === -1) return [...items, item]
  return items.map(current => current.id === item.id ? item : current)
}

function exhaustive(value: never): never {
  throw new Error(`Unsupported process command: ${JSON.stringify(value)}`)
}
