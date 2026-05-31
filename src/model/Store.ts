import {
  Nova,
  Reactive,
  Store as NovaStore,
} from '@endge/nova'
import type {
  ModelerElement,
  ModelerCanvas,
  ModelerCommand,
  ModelerRect,
  ModelerStore,
  ModelerModel,
  ModelerModelInput,
  ModelerViewport,
} from '@/domain/types'
import {
  DEFAULT_MODELER_CANVAS,
  DEFAULT_MODELER_VIEWPORT,
} from '@/config/model.config'
import type { ModelerElementRegistry } from '@/domain/types'
import { createModelerElementRegistry } from '@/model/ElementRegistry'

@NovaStore()
export class ViewportStore {
  @Reactive({ phase: 'render' })
  x = DEFAULT_MODELER_VIEWPORT.x

  @Reactive({ phase: 'render' })
  y = DEFAULT_MODELER_VIEWPORT.y

  @Reactive({ phase: 'render' })
  scale = DEFAULT_MODELER_VIEWPORT.scale

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
  x = DEFAULT_MODELER_CANVAS.x

  @Reactive({ phase: 'render' })
  y = DEFAULT_MODELER_CANVAS.y

  @Reactive({ phase: 'render' })
  width = DEFAULT_MODELER_CANVAS.width

  @Reactive({ phase: 'render' })
  height = DEFAULT_MODELER_CANVAS.height

  @Reactive({ phase: 'render' })
  gridSize = DEFAULT_MODELER_CANVAS.gridSize

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
  ids: Array<string> = []

  set(ids: Array<string>): void {
    this.ids = [...ids]
  }

  toJSON(): Array<string> {
    return [...this.ids]
  }
}

@NovaStore()
export class ElementsStore {
  @Reactive({ phase: 'render' })
  items: Array<ModelerElement> = []

  load(input: Array<ModelerElement> = []): void {
    this.items = input.map(element => cloneElement(element))
  }

  set(items: Array<ModelerElement>): void {
    this.items = items.map(element => cloneElement(element))
  }

  toJSON(): Array<ModelerElement> {
    return this.items.map(element => cloneElement(element))
  }
}

@NovaStore()
export class Store implements ModelerStore {
  @Reactive()
  viewport = new ViewportStore()

  @Reactive()
  canvas = new CanvasStore()

  @Reactive()
  elements = new ElementsStore()

  @Reactive()
  selection = new SelectionStore()

  @Reactive({ phase: 'render' })
  id = 'modeler'

  @Reactive({ phase: 'render' })
  version = 0

  @Reactive({ phase: 'render' })
  viewportVersion = 0

  @Reactive({ phase: 'render' })
  elementsVersion = 0

  @Reactive({ phase: 'render' })
  selectionVersion = 0

  private readonly elementRegistry: ModelerElementRegistry

  constructor(
    input: ModelerModel | ModelerModelInput = {},
    options: { elementRegistry?: ModelerElementRegistry } = {},
  ) {
    this.elementRegistry = options.elementRegistry ?? createModelerElementRegistry()
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
    if (command.type === 'element.add') {
      this.addElement(command.element)
      return this.toModel()
    }
    if (command.type === 'element.patch') {
      this.patchElement(command.id, command.patch)
      return this.toModel()
    }
    if (command.type === 'element.resize') {
      this.resizeElement(command.id, command.bounds)
      return this.toModel()
    }
    if (command.type === 'element.move') {
      this.moveElement(command.id, command.dx, command.dy)
      return this.toModel()
    }
    if (command.type === 'element.rotate') {
      this.rotateElement(command.id, command.rotation)
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

  addElement(element: ModelerElement): void {
    Nova.batchStore(this, () => {
      this.elements.set([...this.elements.items, this.normalizeElement(element)])
      this.version += 1
      this.elementsVersion += 1
    })
  }

  patchElement(id: string, patch: Partial<ModelerElement>): void {
    Nova.batchStore(this, () => {
      this.elements.set(this.elements.items.map(element => {
        if (element.id !== id) return element
        return this.normalizeElement({
          ...element,
          ...patch,
          data: patch.data ? { ...element.data, ...patch.data } : element.data,
          style: patch.style ? { ...element.style, ...patch.style } : element.style,
        } as ModelerElement)
      }))
      this.version += 1
      this.elementsVersion += 1
    })
  }

  resizeElement(id: string, bounds: Partial<ModelerRect>): void {
    Nova.batchStore(this, () => {
      this.elements.set(this.elements.items.map(element => {
        if (element.id !== id) return element
        const resize = this.elementRegistry.get(element.type)?.capabilities?.resizable
        const minWidth = resize ? resize.minWidth ?? 1 : 1
        const minHeight = resize ? resize.minHeight ?? 1 : 1
        return this.normalizeElement({
          ...element,
          x: bounds.x ?? element.x,
          y: bounds.y ?? element.y,
          width: Math.max(minWidth, bounds.width ?? element.width),
          height: Math.max(minHeight, bounds.height ?? element.height),
        })
      }))
      this.version += 1
      this.elementsVersion += 1
    })
  }

  moveElement(id: string, dx: number, dy: number): void {
    Nova.batchStore(this, () => {
      this.elements.set(this.elements.items.map(element => element.id === id
        ? this.normalizeElement({ ...element, x: element.x + dx, y: element.y + dy })
        : element))
      this.version += 1
      this.elementsVersion += 1
    })
  }

  rotateElement(id: string, rotation: number): void {
    Nova.batchStore(this, () => {
      this.elements.set(this.elements.items.map(element => element.id === id
        ? this.normalizeElement({ ...element, rotation })
        : element))
      this.version += 1
      this.elementsVersion += 1
    })
  }

  load(input: ModelerModel | ModelerModelInput = {}): void {
    const maybeModel = input as Partial<ModelerModel>
    Nova.batchStore(this, () => {
      this.id = input.id ?? 'modeler'
      this.viewport.load(input.viewport)
      this.canvas.load(input.canvas)
      this.elements.load((input.elements ?? []).map(element => this.normalizeElement(element)))
      this.selection.set(input.selection ?? [])
      this.version = maybeModel.version ?? 0
      this.viewportVersion = maybeModel.viewportVersion ?? 0
      this.elementsVersion = maybeModel.elementsVersion ?? 0
      this.selectionVersion = maybeModel.selectionVersion ?? 0
    })
  }

  toModel(): ModelerModel {
    return {
      id: this.id,
      viewport: this.viewport.toJSON(),
      canvas: this.canvas.toJSON(),
      elements: this.elements.toJSON(),
      selection: this.selection.toJSON(),
      version: this.version,
      viewportVersion: this.viewportVersion,
      elementsVersion: this.elementsVersion,
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

  private normalizeElement(element: ModelerElement): ModelerElement {
    const definition = this.elementRegistry.get(element.type)
    const normalized = definition?.normalize?.(cloneElement(element)) ?? cloneElement(element)
    return {
      ...normalized,
      data: normalized.data ?? {},
      style: normalized.style ?? {},
    }
  }
}

export function createModelerStore(input: ModelerModel | ModelerModelInput = {}): Store {
  return new Store(input)
}

export const createModelerModel = Store.create
export const normalizeModelerModel = Store.normalize
export const applyModelerCommand = Store.applyCommand

function cloneElement(element: ModelerElement): ModelerElement {
  return {
    ...element,
    data: element.data ? { ...element.data } : {},
    style: element.style ? { ...element.style } : {},
  }
}
