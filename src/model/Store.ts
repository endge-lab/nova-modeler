import type {
  ModelerCommand,
  ModelerModel,
  ModelerModelInput,
} from '@/domain/types'
import {
  DEFAULT_MODELER_CANVAS,
  DEFAULT_MODELER_VIEWPORT,
} from '@/config/model.config'

export class Store {
  private model: ModelerModel
  private readonly listeners = new Set<(model: ModelerModel) => void>()

  constructor(input: ModelerModel | ModelerModelInput = {}) {
    this.model = Store.normalize(input)
  }

  getModel(): ModelerModel {
    return this.model
  }

  setModel(input: ModelerModel | ModelerModelInput): ModelerModel {
    return this.commit(Store.normalize(input))
  }

  apply(command: ModelerCommand): ModelerModel {
    return this.commit(Store.applyCommand(this.model, command))
  }

  subscribe(listener: (model: ModelerModel) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private commit(model: ModelerModel): ModelerModel {
    this.model = model
    for (const listener of this.listeners) listener(model)
    return model
  }

  static create(input: ModelerModelInput = {}): ModelerModel {
    return {
      id: input.id ?? 'modeler',
      viewport: { ...DEFAULT_MODELER_VIEWPORT, ...(input.viewport ?? {}) },
      canvas: { ...DEFAULT_MODELER_CANVAS, ...(input.canvas ?? {}) },
      selection: [...(input.selection ?? [])],
      version: 0,
      viewportVersion: 0,
      selectionVersion: 0,
    }
  }

  static normalize(input: ModelerModel | ModelerModelInput): ModelerModel {
    const maybeModel = input as Partial<ModelerModel>
    return {
      ...Store.create(input),
      version: maybeModel.version ?? 0,
      viewportVersion: maybeModel.viewportVersion ?? 0,
      selectionVersion: maybeModel.selectionVersion ?? 0,
    }
  }

  static applyCommand(model: ModelerModel, command: ModelerCommand): ModelerModel {
    if (command.type === 'setViewport') {
      return {
        ...model,
        viewport: { ...model.viewport, ...command.viewport },
        version: model.version + 1,
        viewportVersion: model.viewportVersion + 1,
      }
    }
    return {
      ...model,
      selection: [...command.ids],
      version: model.version + 1,
      selectionVersion: model.selectionVersion + 1,
    }
  }
}

export function createModelerStore(input: ModelerModel | ModelerModelInput = {}): Store {
  return new Store(input)
}

export const createModelerModel = Store.create
export const normalizeModelerModel = Store.normalize
export const applyModelerCommand = Store.applyCommand
