import {
  Nova,
  Reactive,
  Store as NovaStore,
} from '@endge/nova'
import type {
  ModelerCanvas,
  ModelerCommand,
  ModelerStore,
  ModelerModel,
  ModelerModelInput,
  ModelerViewport,
} from '@/domain/types'
import {
  DEFAULT_MODELER_CANVAS,
  DEFAULT_MODELER_VIEWPORT,
} from '@/config/model.config'

@NovaStore()
export class ViewportStore {
  @Reactive({ phase: 'render' })
  accessor x = DEFAULT_MODELER_VIEWPORT.x

  @Reactive({ phase: 'render' })
  accessor y = DEFAULT_MODELER_VIEWPORT.y

  @Reactive({ phase: 'render' })
  accessor scale = DEFAULT_MODELER_VIEWPORT.scale

  load(input: Partial<ModelerViewport> = {}): void {
    this.x = input.x ?? DEFAULT_MODELER_VIEWPORT.x
    this.y = input.y ?? DEFAULT_MODELER_VIEWPORT.y
    this.scale = input.scale ?? DEFAULT_MODELER_VIEWPORT.scale
  }

  toJSON(): ModelerViewport {
    return {
      x: this.x,
      y: this.y,
      scale: this.scale,
    }
  }
}

@NovaStore()
export class CanvasStore {
  @Reactive({ phase: 'render' })
  accessor x = DEFAULT_MODELER_CANVAS.x

  @Reactive({ phase: 'render' })
  accessor y = DEFAULT_MODELER_CANVAS.y

  @Reactive({ phase: 'render' })
  accessor width = DEFAULT_MODELER_CANVAS.width

  @Reactive({ phase: 'render' })
  accessor height = DEFAULT_MODELER_CANVAS.height

  @Reactive({ phase: 'render' })
  accessor gridSize = DEFAULT_MODELER_CANVAS.gridSize

  load(input: Partial<ModelerCanvas> = {}): void {
    this.x = input.x ?? DEFAULT_MODELER_CANVAS.x
    this.y = input.y ?? DEFAULT_MODELER_CANVAS.y
    this.width = input.width ?? DEFAULT_MODELER_CANVAS.width
    this.height = input.height ?? DEFAULT_MODELER_CANVAS.height
    this.gridSize = input.gridSize ?? DEFAULT_MODELER_CANVAS.gridSize
  }

  toJSON(): ModelerCanvas {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      gridSize: this.gridSize,
    }
  }
}

@NovaStore()
export class SelectionStore {
  @Reactive({ phase: 'render' })
  accessor ids: Array<string> = []

  set(ids: Array<string>): void {
    this.ids = [...ids]
  }

  toJSON(): Array<string> {
    return [...this.ids]
  }
}

@NovaStore()
export class Store implements ModelerStore {
  @Reactive()
  accessor viewport = new ViewportStore()

  @Reactive()
  accessor canvas = new CanvasStore()

  @Reactive()
  accessor selection = new SelectionStore()

  @Reactive({ phase: 'render' })
  accessor id = 'modeler'

  @Reactive({ phase: 'render' })
  accessor version = 0

  @Reactive({ phase: 'render' })
  accessor viewportVersion = 0

  @Reactive({ phase: 'render' })
  accessor selectionVersion = 0

  constructor(input: ModelerModel | ModelerModelInput = {}) {
    this.load(input)
  }

  getModel(): ModelerModel {
    return this.toModel()
  }

  setModel(input: ModelerModel | ModelerModelInput): ModelerModel {
    this.load(input)
    return this.toModel()
  }

  apply(command: ModelerCommand): ModelerModel {
    if (command.type === 'setViewport') {
      this.setViewport(command.viewport)
      return this.toModel()
    }
    this.setSelection(command.ids)
    return this.toModel()
  }

  setViewport(viewport: Partial<ModelerViewport>): void {
    Nova.batchStore(this, () => {
      if (viewport.x !== undefined) this.viewport.x = viewport.x
      if (viewport.y !== undefined) this.viewport.y = viewport.y
      if (viewport.scale !== undefined) this.viewport.scale = viewport.scale
      this.version += 1
      this.viewportVersion += 1
    })
  }

  setSelection(ids: Array<string>): void {
    Nova.batchStore(this, () => {
      this.selection.set(ids)
      this.version += 1
      this.selectionVersion += 1
    })
  }

  load(input: ModelerModel | ModelerModelInput = {}): void {
    const maybeModel = input as Partial<ModelerModel>
    Nova.batchStore(this, () => {
      this.id = input.id ?? 'modeler'
      this.viewport.load(input.viewport)
      this.canvas.load(input.canvas)
      this.selection.set(input.selection ?? [])
      this.version = maybeModel.version ?? 0
      this.viewportVersion = maybeModel.viewportVersion ?? 0
      this.selectionVersion = maybeModel.selectionVersion ?? 0
    })
  }

  toModel(): ModelerModel {
    return {
      id: this.id,
      viewport: this.viewport.toJSON(),
      canvas: this.canvas.toJSON(),
      selection: this.selection.toJSON(),
      version: this.version,
      viewportVersion: this.viewportVersion,
      selectionVersion: this.selectionVersion,
    }
  }

  static create(input: ModelerModelInput = {}): ModelerModel {
    return new Store(input).toModel()
  }

  static normalize(input: ModelerModel | ModelerModelInput): ModelerModel {
    return new Store(input).toModel()
  }

  static applyCommand(model: ModelerModel, command: ModelerCommand): ModelerModel {
    const store = new Store(model)
    return store.apply(command)
  }
}

export function createModelerStore(input: ModelerModel | ModelerModelInput = {}): Store {
  return new Store(input)
}

export const createModelerModel = Store.create
export const normalizeModelerModel = Store.normalize
export const applyModelerCommand = Store.applyCommand
