import {
  NovaComponentNode,
  type NovaApp,
  type NovaSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { importBpmnXml, exportBpmnXml } from '@/model/bpmn/process-bpmn'
import { compileLowCodeManifest } from '@/model/low-code/process-low-code'
import {
  createProcessModelerLayout,
  hitTestProcessModelerLayout,
  processModelBounds,
} from '@/model/layout/process-layout'
import { createProcessModel } from '@/model/store/process-model'
import { createProcessModelStore } from '@/model/store/ProcessModelStore'
import type { ProcessModelStore } from '@/model/store/ProcessModelStore'
import { validateProcessModel } from '@/model/validation/process-validation'
import type {
  ProcessCommand,
  ProcessElementId,
  ProcessModel,
  ProcessModelInput,
  ProcessModelerLayout,
  ProcessModelerRootApi,
  ProcessModelerRootProps,
  ProcessModelerRootResolvedProps,
  ProcessNodeKind,
  ProcessResolvedPort,
  ProcessViewport,
} from '@/model/types/process-modeler.types'
import {
  PROCESS_MODELER_ROOT_NODE_DESCRIPTOR,
  type ProcessModelerRootDescriptor,
} from '@/ui/root/process-modeler-root.config'
import {
  PROCESS_MODELER_ASSETS,
  resolveProcessModelerNodeIconName,
} from '@/assets/process-modeler-assets'
import {
  areProcessPortsCompatible,
  canUseProcessPortForDirection,
  getDefaultProcessPort,
} from '@/model/ports/process-ports'
import {
  getBuiltinProcessElementCatalog,
  type ProcessElementCatalog,
} from '@/ui/elements/process-element-catalog'
import type { ProcessElementNode } from '@/ui/elements/ProcessElementNode'

const PALETTE_ITEMS: Array<{ kind: ProcessNodeKind; label: string }> = [
  { kind: 'startEvent', label: 'Start' },
  { kind: 'userTask', label: 'User task' },
  { kind: 'serviceTask', label: 'Service' },
  { kind: 'exclusiveGateway', label: 'Exclusive' },
  { kind: 'parallelGateway', label: 'Parallel' },
  { kind: 'endEvent', label: 'End' },
]
const TOUCHPAD_ZOOM_SENSITIVITY = 0.006

/** Nova root-компонент визуального process modeler. */
export class ProcessModelerRoot<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ProcessModelerRootResolvedProps, ProcessModelerRootApi, Record<string, never>, ProcessModelerRootProps, E> {
  private store: ProcessModelStore
  private layout: ProcessModelerLayout
  private readonly elementCatalog: ProcessElementCatalog<E>
  private readonly elementNodes = new Map<ProcessNodeKind, ProcessElementNode<E>>()
  private readonly api: ProcessModelerRootApi
  private dragState: { type: 'node'; id: string; x: number; y: number } | { type: 'pan'; x: number; y: number } | { type: 'connect'; sourcePort: ProcessResolvedPort; x: number; y: number; hoveredPort?: ProcessResolvedPort } | null = null
  private pendingPaletteKind: ProcessNodeKind | null = null

  /** Создает root-компонент modeler и подготавливает API. */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: ProcessModelerRootResolvedProps,
    options: { componentId?: string } = {},
    descriptor: ProcessModelerRootDescriptor = PROCESS_MODELER_ROOT_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, options)
    this.nova.assets.use(PROCESS_MODELER_ASSETS)
    this.elementCatalog = getBuiltinProcessElementCatalog<E>()
    for (const item of PALETTE_ITEMS) {
      this.elementNodes.set(item.kind, this.elementCatalog.createNode(item.kind, app, surface))
    }
    this.store = createProcessModelStore(props.model)
    this.layout = this.createLayout()
    this.api = {
      setModel: model => this.setModel(model),
      getModel: () => this.store.getModel(),
      applyCommand: command => this.applyCommand(command),
      undo: () => this.commitModel(this.store.undo()),
      redo: () => this.commitModel(this.store.redo()),
      validate: () => this.validate(),
      fitView: () => this.fitView(),
      focusElement: id => this.focusElement(id),
      exportBpmnXml: () => exportBpmnXml(this.store.getModel()),
      compileLowCodeManifest: () => compileLowCodeManifest(this.store.getModel()),
    }
    this.options({ width: props.width, height: props.height, interactive: true })
    this.setupEvents()
  }

  /** Возвращает публичный API root-компонента. */
  override getApi(): ProcessModelerRootApi {
    return this.api
  }

  /** Обновляет props и синхронизирует store при внешней замене модели. */
  override setProps(patch: Partial<ProcessModelerRootResolvedProps>): this {
    super.setProps(patch)
    if (patch.model) this.store = createProcessModelStore(patch.model)
    this.layout = this.createLayout()
    return this
  }

  /** Пересчитывает layout перед render. */
  update(): void {
    this.layout = this.createLayout()
  }

  /** Рисует полный редактор в одном Nova tree node. */
  render(): void {
    this.layout = this.createLayout()
    const model = this.store.getModel()
    const issues = validateProcessModel(model)
    const schema: NovaSchema = [] as unknown as NovaSchema

    pushRect(schema, 0, 0, this.props.width, this.props.height, '#f4f7fb')
    this.renderPalette(schema)
    this.renderCanvas(schema)
    this.renderInspector(schema, model)
    this.renderValidation(schema, issues)
    this.renderer.schema(schema)
  }

  /** Root всегда принимает hit-test внутри своих границ. */
  override containsPoint(x: number, y: number): boolean {
    return x >= 0 && x <= this.props.width && y >= 0 && y <= this.props.height
  }

  private setModel(model: ProcessModelInput | ProcessModel): void {
    const next = this.store.setModel(createProcessModel(model))
    this.commitModel(next)
  }

  private applyCommand(command: ProcessCommand): ProcessModel {
    const next = this.store.applyCommand(command)
    return this.commitModel(next)
  }

  private validate(): Array<ReturnType<typeof validateProcessModel>[number]> {
    const issues = validateProcessModel(this.store.getModel())
    this.props.onValidationChange?.(issues)
    return issues
  }

  private fitView(): ProcessViewport {
    const bounds = processModelBounds(this.store.getModel())
    const canvas = this.layout.canvas
    const scale = Math.max(0.4, Math.min(1.6, Math.min((canvas.width - 80) / bounds.width, (canvas.height - 80) / bounds.height)))
    const viewport = {
      x: -bounds.x * scale + 40,
      y: -bounds.y * scale + 40,
      scale,
    }
    this.commitModel(this.store.applyCommand({ type: 'setViewport', viewport }))
    return viewport
  }

  private focusElement(id: ProcessElementId): boolean {
    const model = this.store.getModel()
    const node = model.nodes.find(item => item.id === id)
    if (!node) return false
    this.commitModel(this.store.applyCommand({ type: 'select', ids: [id] }))
    return true
  }

  private commitModel(model: ProcessModel): ProcessModel {
    this.props.model = model
    this.layout = this.createLayout()
    this.props.onModelChange?.(model)
    this.props.onSelectionChange?.(model.selection)
    this.props.onValidationChange?.(validateProcessModel(model))
    this.dirty({ update: true, render: true })
    return model
  }

  private createLayout(): ProcessModelerLayout {
    return createProcessModelerLayout(this.store.getModel(), {
      width: this.props.width,
      height: this.props.height,
      paletteWidth: this.props.paletteWidth,
      inspectorWidth: this.props.inspectorWidth,
    })
  }

  private setupEvents(): void {
    this.on('mousedown', event => {
      const point = eventPoint(event)
      const target = hitTestProcessModelerLayout(this.layout, point)
      if (target.type === 'palette' && target.kind && !this.props.readonly) {
        this.pendingPaletteKind = target.kind
        return false
      }
      if (target.type === 'port' && target.nodeId && target.portId && !this.props.readonly) {
        const sourcePort = this.findResolvedPort(target.nodeId, target.portId)
        if (sourcePort && canUseProcessPortForDirection(sourcePort, 'output')) {
          this.dragState = { type: 'connect', sourcePort, x: point.x, y: point.y }
          this.commitModel(this.store.applyCommand({ type: 'select', ids: [sourcePort.nodeId] }))
        }
        return false
      }
      if (target.type === 'node' && target.id) {
        const model = this.store.getModel()
        const selected = model.selection[0]
        if (event.shiftKey && selected && selected !== target.id && !this.props.readonly) {
          const source = model.nodes.find(node => node.id === selected)
          const targetNode = model.nodes.find(node => node.id === target.id)
          const sourcePort = source ? getDefaultProcessPort(source, 'output') : undefined
          const targetPort = targetNode ? getDefaultProcessPort(targetNode, 'input') : undefined
          if (!sourcePort || !targetPort || !areProcessPortsCompatible(sourcePort, targetPort)) return false
          this.commitModel(this.store.applyCommand({
            type: 'connect',
            sourceId: selected,
            targetId: String(target.id),
            sourcePortId: sourcePort?.id,
            targetPortId: targetPort?.id,
            metadata: { name: 'Flow' },
          }))
          return false
        }
        this.dragState = { type: 'node', id: String(target.id), x: point.x, y: point.y }
        this.commitModel(this.store.applyCommand({ type: 'select', ids: [String(target.id)], mode: event.metaKey || event.ctrlKey ? 'toggle' : 'replace' }))
        return false
      }
      if (target.type === 'edge' && target.id) {
        this.commitModel(this.store.applyCommand({ type: 'select', ids: [String(target.id)] }))
        return false
      }
      if (target.type === 'canvas') {
        this.dragState = { type: 'pan', x: point.x, y: point.y }
        this.commitModel(this.store.applyCommand({ type: 'select', ids: [] }))
        return false
      }
      return false
    })

    this.on('mousemove', event => {
      if (!this.dragState || this.props.readonly) return false
      const point = eventPoint(event)
      if (this.dragState.type === 'connect') {
        const target = hitTestProcessModelerLayout(this.layout, point)
        const hoveredPort = target.type === 'port' && target.nodeId && target.portId
          ? this.findResolvedPort(target.nodeId, target.portId)
          : undefined
        this.dragState = {
          type: 'connect',
          sourcePort: this.dragState.sourcePort,
          x: point.x,
          y: point.y,
          hoveredPort: hoveredPort && this.canConnectPorts(this.dragState.sourcePort, hoveredPort) ? hoveredPort : undefined,
        }
        this.dirty({ render: true })
        return false
      }
      if (this.dragState.type === 'pan') {
        const dx = point.x - this.dragState.x
        const dy = point.y - this.dragState.y
        this.dragState = { type: 'pan', x: point.x, y: point.y }
        this.panViewport(dx, dy)
        return false
      }
      const scale = this.store.getModel().viewport.scale
      const dx = (point.x - this.dragState.x) / scale
      const dy = (point.y - this.dragState.y) / scale
      this.dragState = { ...this.dragState, x: point.x, y: point.y }
      this.commitModel(this.store.applyCommand({ type: 'moveNode', id: this.dragState.id, dx, dy }))
      return false
    })

    this.on('mouseup', event => {
      const point = eventPoint(event)
      const target = hitTestProcessModelerLayout(this.layout, point)
      if (this.dragState?.type === 'connect' && this.dragState.hoveredPort && !this.props.readonly) {
        this.commitModel(this.store.applyCommand({
          type: 'connect',
          sourceId: this.dragState.sourcePort.nodeId,
          targetId: this.dragState.hoveredPort.nodeId,
          sourcePortId: this.dragState.sourcePort.id,
          targetPortId: this.dragState.hoveredPort.id,
          metadata: { name: 'Flow' },
        }))
        this.dragState = null
        return false
      }
      if (this.pendingPaletteKind && target.type === 'canvas' && !this.props.readonly) {
        const model = this.store.getModel()
        const x = (point.x - this.layout.canvas.x - model.viewport.x - 12) / model.viewport.scale
        const y = (point.y - this.layout.canvas.y - model.viewport.y - 12) / model.viewport.scale
        this.commitModel(this.store.applyCommand({
          type: 'addNode',
          node: {
            id: `${this.pendingPaletteKind}-${Date.now().toString(36)}`,
            kind: this.pendingPaletteKind,
            x,
            y,
            metadata: { name: paletteLabel(this.pendingPaletteKind) },
          },
        }))
      }
      this.pendingPaletteKind = null
      this.dragState = null
      return false
    })

    this.on('wheel', event => {
      const model = this.store.getModel()
      const dx = Number.isFinite(event.deltaX) ? -event.deltaX : 0
      const dy = Number.isFinite(event.deltaY) ? -event.deltaY : 0
      this.commitModel(this.store.applyCommand({
        type: 'setViewport',
        viewport: {
          x: model.viewport.x + dx,
          y: model.viewport.y + dy,
        },
      }))
      return false
    })

    this.on('zoom', event => {
      this.zoomViewport(eventPoint(event), event.deltaY)
      return false
    })

    this.on('keydown', event => {
      if (this.props.readonly) return
      if (event.key === 'Escape' && this.dragState?.type === 'connect') {
        this.dragState = null
        this.dirty({ render: true })
        return false
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selection = this.store.getModel().selection
        if (selection.length > 0) this.commitModel(this.store.applyCommand({ type: 'delete', ids: selection }))
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') this.commitModel(this.store.undo())
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') this.commitModel(this.store.redo())
    })
  }

  private panViewport(dx: number, dy: number): ProcessViewport {
    const model = this.store.getModel()
    const viewport = {
      x: model.viewport.x + dx,
      y: model.viewport.y + dy,
      scale: model.viewport.scale,
    }
    this.commitModel(this.store.applyCommand({ type: 'setViewport', viewport }))
    return viewport
  }

  private zoomViewport(point: { x: number; y: number }, deltaY: number): ProcessViewport {
    const model = this.store.getModel()
    const oldViewport = model.viewport
    const scale = Math.max(0.35, Math.min(2.4, oldViewport.scale * Math.exp(-deltaY * TOUCHPAD_ZOOM_SENSITIVITY)))
    const originX = point.x - this.layout.canvas.x - 12
    const originY = point.y - this.layout.canvas.y - 12
    const worldX = (originX - oldViewport.x) / oldViewport.scale
    const worldY = (originY - oldViewport.y) / oldViewport.scale
    const viewport = {
      x: originX - worldX * scale,
      y: originY - worldY * scale,
      scale,
    }
    this.commitModel(this.store.applyCommand({ type: 'setViewport', viewport }))
    return viewport
  }

  private findResolvedPort(nodeId: string, portId: string): ProcessResolvedPort | undefined {
    return this.layout.ports.find(port => port.nodeId === nodeId && port.id === portId)
  }

  private canConnectPorts(source: ProcessResolvedPort, target: ProcessResolvedPort): boolean {
    return source.nodeId !== target.nodeId && areProcessPortsCompatible(source, target)
  }

  private renderPalette(schema: NovaSchema): void {
    const panel = this.layout.palette
    if (panel.width <= 0) return
    pushRect(schema, panel.x, panel.y, panel.width, panel.height, '#101820')
    pushText(schema, 'PROCESS', 18, 18, panel.width - 36, 18, '#9fb5c8', 11, '800')
    pushText(schema, 'Modeler', 18, 36, panel.width - 36, 24, '#ffffff', 20, '800')
    PALETTE_ITEMS.forEach((item, index) => {
      const y = 72 + index * 42
      pushRect(schema, 14, y, panel.width - 28, 32, '#182633', 7, '#31475b')
      pushNodeGlyph(schema, item.kind, 28, y + 8, 18, item.kind === this.pendingPaletteKind)
      pushText(schema, item.label, 58, y + 7, panel.width - 78, 18, '#e8f0f7', 12, '700')
    })
    pushText(schema, 'Shift-click target to connect from selected node.', 18, panel.height - 54, panel.width - 36, 36, '#87a0b4', 11, '600')
  }

  private renderCanvas(schema: NovaSchema): void {
    const canvas = this.layout.canvas
    pushRect(schema, canvas.x, canvas.y, canvas.width, canvas.height, '#eef3f8')
    pushGrid(schema, canvas)
    for (const edge of this.layout.edges) renderEdge(schema, edge)
    this.renderConnectionPreview(schema)
    for (const node of this.layout.nodes) {
      const renderer = this.elementNodes.get(node.kind)
      if (!renderer) continue
      renderer.renderElement(schema, node)
      const nodePorts = this.layout.ports.filter(port => port.nodeId === node.id)
      renderer.renderPorts(schema, nodePorts, this.createPortRenderState(node.id))
    }
  }

  private createPortRenderState(nodeId: string): { portsVisible: boolean; activePortId?: string; hoveredPortId?: string; validPortIds?: Set<string> } {
    const model = this.store.getModel()
    const connectState = this.dragState?.type === 'connect' ? this.dragState : null
    if (!connectState) {
      return { portsVisible: model.selection.includes(nodeId) }
    }

    return {
      portsVisible: true,
      activePortId: portKey(connectState.sourcePort),
      hoveredPortId: connectState.hoveredPort ? portKey(connectState.hoveredPort) : undefined,
      validPortIds: new Set(this.layout.ports.filter(port => this.canConnectPorts(connectState.sourcePort, port)).map(portKey)),
    }
  }

  private renderConnectionPreview(schema: NovaSchema): void {
    if (this.dragState?.type !== 'connect') return
    const target = this.dragState.hoveredPort ?? { x: this.dragState.x, y: this.dragState.y }
    const valid = Boolean(this.dragState.hoveredPort)
    schema.push({
      type: 'line',
      x1: this.dragState.sourcePort.x,
      y1: this.dragState.sourcePort.y,
      x2: target.x,
      y2: target.y,
      styles: {
        color: valid ? '#2563eb' : '#98a2b3',
        width: 2,
        dashPattern: valid ? [] : [6, 5],
      },
      meta: { processElementType: 'connection-preview', valid },
    })
  }

  private renderInspector(schema: NovaSchema, model: ProcessModel): void {
    const panel = this.layout.inspector
    const selected = model.selection[0]
    const node = model.nodes.find(item => item.id === selected)
    const edge = model.edges.find(item => item.id === selected)
    pushRect(schema, panel.x, panel.y, panel.width, panel.height, '#ffffff')
    pushText(schema, 'INSPECTOR', panel.x + 18, 20, panel.width - 36, 18, '#667085', 11, '900')
    pushText(schema, node?.metadata.name ?? edge?.metadata.name ?? selected ?? 'No selection', panel.x + 18, 44, panel.width - 36, 26, '#111827', 18, '800')
    pushText(schema, node ? node.kind : edge ? 'sequenceFlow' : 'Select an element on canvas', panel.x + 18, 78, panel.width - 36, 18, '#475467', 12, '700')
    const rows = node
      ? [`id: ${node.id}`, `form: ${node.metadata.formId ?? '-'}`, `action: ${node.metadata.actionId ?? '-'}`, `assignee: ${node.metadata.assignee ?? '-'}`]
      : edge
        ? [`id: ${edge.id}`, `from: ${edge.sourceId}`, `to: ${edge.targetId}`, `condition: ${edge.metadata.condition ?? '-'}`]
        : [`nodes: ${model.nodes.length}`, `edges: ${model.edges.length}`, `zoom: ${Math.round(model.viewport.scale * 100)}%`]
    rows.forEach((row, index) => pushText(schema, row, panel.x + 18, 128 + index * 28, panel.width - 36, 18, '#253244', 12, '600'))
  }

  private renderValidation(schema: NovaSchema, issues: Array<ReturnType<typeof validateProcessModel>[number]>): void {
    const panel = this.layout.validation
    pushRect(schema, panel.x, panel.y, panel.width, panel.height, issues.length ? '#fff8ec' : '#ecfdf3')
    pushText(schema, issues.length ? `${issues.length} validation issues` : 'Validation clean', panel.x + 18, panel.y + 14, panel.width - 36, 20, issues.length ? '#9a3412' : '#067647', 14, '800')
    const visible = issues.slice(0, 2)
    visible.forEach((issue, index) => pushText(schema, issue.message, panel.x + 18, panel.y + 42 + index * 20, panel.width - 36, 16, '#475467', 10, '600'))
  }
}

function renderEdge(schema: NovaSchema, edge: ProcessModelerLayout['edges'][number]): void {
  const color = edge.invalid ? '#f97316' : edge.selected ? '#2563eb' : '#667085'
  for (let index = 1; index < edge.points.length; index += 1) {
    const a = edge.points[index - 1]
    const b = edge.points[index]
    if (!a || !b) continue
    schema.push({ type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, styles: { color, width: edge.selected ? 3 : 2 } })
  }
  const end = edge.points[edge.points.length - 1]
  if (end) {
    schema.push({ type: 'polygon', points: [{ x: end.x, y: end.y }, { x: end.x - 8, y: end.y - 5 }, { x: end.x - 8, y: end.y + 5 }], styles: { background: color } })
  }
}

function pushGrid(schema: NovaSchema, rect: { x: number; y: number; width: number; height: number }): void {
  for (let x = rect.x; x < rect.x + rect.width; x += 32) {
    schema.push({ type: 'line', x1: x, y1: rect.y, x2: x, y2: rect.y + rect.height, styles: { color: 'rgba(102,112,133,0.12)', width: 1 } })
  }
  for (let y = rect.y; y < rect.y + rect.height; y += 32) {
    schema.push({ type: 'line', x1: rect.x, y1: y, x2: rect.x + rect.width, y2: y, styles: { color: 'rgba(102,112,133,0.12)', width: 1 } })
  }
}

function pushNodeGlyph(schema: NovaSchema, kind: ProcessNodeKind, x: number, y: number, size: number, active: boolean): void {
  pushNodeIcon(schema, kind, x, y, size, active ? 'dark' : 'light')
}

function pushNodeIcon(schema: NovaSchema, kind: ProcessNodeKind, x: number, y: number, size: number, tone: 'dark' | 'light' = 'dark'): void {
  const icon = PROCESS_MODELER_ASSETS.icons[resolveProcessModelerNodeIconName(kind, tone)]
  schema.push({
    type: 'icon',
    icon,
    x,
    y,
    width: size,
    height: size,
    styles: { quality: 'crisp' },
  })
}

function pushRect(schema: NovaSchema, x: number, y: number, width: number, height: number, background: string, radius = 0, borderColor?: string, borderWidth = 1): void {
  schema.push({
    type: 'rect',
    x,
    y,
    width,
    height,
    styles: {
      background,
      radius,
      ...(borderColor ? { border: { color: borderColor, width: borderWidth, radius } } : {}),
    },
  })
}

function pushText(schema: NovaSchema, text: string, x: number, y: number, width: number, height: number, color: string, size: number, weight: '600' | '700' | '800' | '900', align: 'left' | 'center' = 'left'): void {
  schema.push({
    type: 'text',
    text,
    x,
    y,
    width,
    height,
    styles: {
      color,
      font: { size, weight, family: 'Avenir Next, ui-sans-serif, system-ui' },
      ellipsis: true,
      align: { horizontal: align, vertical: 'middle' },
    },
  })
}

function eventPoint(event: MouseEvent): { x: number; y: number } {
  return {
    x: Number.isFinite(event.offsetX) ? event.offsetX : event.clientX,
    y: Number.isFinite(event.offsetY) ? event.offsetY : event.clientY,
  }
}

function paletteLabel(kind: ProcessNodeKind): string {
  return PALETTE_ITEMS.find(item => item.kind === kind)?.label ?? kind
}

function portKey(port: Pick<ProcessResolvedPort, 'nodeId' | 'id'>): string {
  return `${port.nodeId}:${port.id}`
}

export { importBpmnXml, exportBpmnXml, compileLowCodeManifest }
