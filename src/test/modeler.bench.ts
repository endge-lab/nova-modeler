import { describe, expect, it, vi } from 'vitest'
import {
  BpmnBatchRuntime,
  BpmnValidationPlugin,
  BpmnValidationRuntime,
  Grid,
  MiniMapPlugin,
  MODEL_ELEMENTS_RUNTIME,
  ModelerVisibilityRuntime,
  appendGridSchema,
  createBpmnEventElement,
  createBpmnFlowElement,
  createBpmnGatewayElement,
  createBpmnTaskElement,
  createPluginRuntime,
  createModelerElementRegistry,
  createGridRenderPlan,
  createModelerController,
  createModelerModel,
  isBpmnRecipeNodeType,
  isBpmnRecipeRenderableNode,
} from '@/index'
import type { NovaSchema } from '@endge/nova'
import type { ModelerElement, ModelerLayout, ModelerModel, ModelerPluginContext, ModelerRect, ModelerViewport } from '@/index'

describe('nova modeler minimal benchmarks', () => {
  it('keeps viewport operations and hit-test bounded', () => {
    const controller = createModelerController({ model: createModelerModel() })
    controller.mount({
      id: 'bench-host',
      app: {
        raph: {
          kernel: {
            set: () => {},
            notify: () => {},
            transaction: (fn: () => void) => fn(),
          },
        },
      } as never,
      width: 1200,
      height: 800,
      invalidate: () => {},
      onModelCommit: () => {},
      layers: {
        get: () => { throw new Error('not used') },
        mount: () => { throw new Error('not used') },
        unmount: () => {},
        reconcile: () => () => {},
      },
    })
    const started = performance.now()
    for (let index = 0; index < 100_000; index += 1) {
      controller.setViewport({ x: index, y: -index, scale: 1 })
      controller.hitTest({ x: index % 1200, y: index % 800 })
    }
    const elapsed = performance.now() - started
    expect(elapsed).toBeLessThan(900)
  })

  it('creates minimap plugin without model element overhead', () => {
    const started = performance.now()
    for (let index = 0; index < 10_000; index += 1) MiniMapPlugin.create({ width: 160, height: 100 })
    expect(performance.now() - started).toBeLessThan(120)
  })

  it('keeps tiny-zoom grid generation under a fixed dot budget', () => {
    const started = performance.now()
    let totalDots = 0
    for (let index = 0; index < 1_000; index += 1) {
      const schema = [] as unknown as NovaSchema
      const plan = createGridRenderPlan({
        width: 2560,
        height: 1440,
        gridSize: 32,
        scale: 0.1,
        viewportX: -index,
        viewportY: index,
      })
      appendGridSchema(schema, plan, '#94a3b8')
      totalDots += schema.length
      expect(plan.dotCount).toBeLessThanOrEqual(32_000)
    }
    expect(totalDots).toBeLessThanOrEqual(2_000_000)
    expect(performance.now() - started).toBeLessThan(700)
  })

  it('keeps procedural grid payload to one GPU pattern item per frame', () => {
    const started = performance.now()
    let schemaItems = 0
    let totalDots = 0
    for (let frame = 0; frame < 1_200; frame += 1) {
      const scale = frame % 3 === 0 ? 0.1 : frame % 3 === 1 ? 0.48 : 1
      const plan = createGridRenderPlan({
        width: 2560,
        height: 1440,
        gridSize: 32,
        scale,
        viewportX: -frame * 3,
        viewportY: frame * 2,
      })
      const schema = Grid.createPatternSchema(plan, 32, scale, '#94a3b8')
      expect(schema.type).toBe('pattern-rect')
      schemaItems += 1
      totalDots += plan.dotCount
    }
    expect(schemaItems).toBe(1_200)
    expect(totalDots).toBeGreaterThan(schemaItems)
    expect(performance.now() - started).toBeLessThan(45)
  })

  it.each([
    [500, 120],
    [2_000, 280],
    [10_000, 1_200],
  ])('keeps retained BPMN node batches stable for %i sparse nodes', (count, budgetMs) => {
    const runtime = new BpmnBatchRuntime()
    const nodes = createSparseBpmnRecipeNodes(count)
    const started = performance.now()
    writeRecipeNodePayload(runtime, nodes)
    const firstRevision = runtime.getFillBatch().revision
    expect(runtime.getDiagnostics()).toMatchObject({
      recipeElements: count,
      visibleElements: count,
      culledElements: 0,
      batchRebuilds: 1,
    })

    for (let index = 0; index < 20; index += 1) writeRecipeNodePayload(runtime, nodes)
    expect(runtime.getFillBatch().revision).toBe(firstRevision)
    expect(runtime.getDiagnostics().panZoomRenderSkips).toBe(20)
    expect(performance.now() - started).toBeLessThan(budgetMs)
  })

  it('keeps visibility queries bounded for 10k nodes and 10k edges', () => {
    const nodes = createSparseBpmnRecipeNodes(10_000)
    const edges = createSparseBpmnRecipeEdges(10_000, nodes)
    const model = createModelerModel({ elements: [...nodes, ...edges] })
    const runtime = new ModelerVisibilityRuntime()
    const started = performance.now()
    let visible = 0
    let maxVisible = 0
    for (let frame = 0; frame < 120; frame += 1) {
      const viewport = { x: -frame * 64, y: -frame * 32, scale: 1 }
      const snapshot = runtime.resolve({
        model: {
          ...model,
          viewport,
          viewportVersion: frame,
        },
        layout: createVisibilityLayout(viewport, 1200, 800),
        viewport,
        useBpmnRecipes: true,
        recipeCulling: true,
        classifier: createVisibilityClassifier(),
      })
      const frameVisible = snapshot.visibleElements
      visible += frameVisible
      maxVisible = Math.max(maxVisible, frameVisible)
    }
    const diagnostics = runtime.getDiagnostics()
    expect(visible).toBeGreaterThan(0)
    expect(maxVisible).toBeLessThan(model.elements.length)
    expect(diagnostics.indexRebuilds).toBe(1)
    expect(diagnostics.indexedNodes).toBe(10_000)
    expect(diagnostics.indexedEdges).toBe(10_000)
    expect(performance.now() - started).toBeLessThan(260)
  })

  it('writes BPMN batch payload only for visible recipe nodes', () => {
    const nodes = createSparseBpmnRecipeNodes(10_000)
    const model = createModelerModel({ elements: nodes })
    const visibility = new ModelerVisibilityRuntime()
    const viewport = { x: 0, y: 0, scale: 1 }
    const visible = visibility.resolve({
      model,
      layout: createVisibilityLayout(viewport, 1200, 800),
      viewport,
      useBpmnRecipes: true,
      recipeCulling: true,
      classifier: createVisibilityClassifier(),
    })
    const runtime = new BpmnBatchRuntime()
    const started = performance.now()
    writeRecipeNodePayload(runtime, visible.recipeNodes)
    expect(visible.recipeNodes.length).toBeGreaterThan(0)
    expect(visible.recipeNodes.length).toBeLessThan(nodes.length)
    expect(runtime.getDiagnostics()).toMatchObject({
      recipeElements: visible.recipeNodes.length,
      visibleElements: visible.recipeNodes.length,
    })
    expect(runtime.getFillBatch().count).toBeLessThan(nodes.length)
    expect(performance.now() - started).toBeLessThan(60)
  })

  it('keeps virtual anchor path resolving bounded for large BPMN graphs', () => {
    const nodes = Array.from({ length: 10_000 }, (_item, index) => {
      const x = (index % 100) * 180
      const y = Math.floor(index / 100) * 120
      if (index % 3 === 0) return createBpmnEventElement({ id: `node-${index}`, x, y })
      if (index % 3 === 1) return createBpmnTaskElement({ id: `node-${index}`, x, y })
      return createBpmnGatewayElement({ id: `node-${index}`, x, y })
    })
    const flows = Array.from({ length: 10_000 }, (_item, index) => createBpmnFlowElement({
      id: `flow-${index}`,
      source: { elementId: `node-${index}`, point: { x: 0, y: 0 } },
      target: { elementId: `node-${(index + 137) % nodes.length}`, point: { x: 0, y: 0 } },
      waypoints: [
        { x: (index % 100) * 180 + 90, y: Math.floor(index / 100) * 120 + 48 },
      ],
    }))
    const context = createBenchContext(createModelerModel({ elements: [...nodes, ...flows] }))
    const started = performance.now()
    let total = 0
    for (const flow of flows) {
      const path = MODEL_ELEMENTS_RUNTIME.edges.createPath(context, flow)
      total += path[0]!.x + path[path.length - 1]!.y
    }
    expect(total).not.toBe(0)
    expect(performance.now() - started).toBeLessThan(900)
  })

  it('keeps route optimizer and edge segment hit-test bounded', () => {
    const source = createBpmnEventElement({ id: 'source', x: 100, y: 100 })
    const target = createBpmnTaskElement({ id: 'target', x: 900, y: 100 })
    const flow = createBpmnFlowElement({
      id: 'flow',
      source: { elementId: source.id, point: { x: 148, y: 124 } },
      target: { elementId: target.id, point: { x: 900, y: 124 } },
      waypoints: [
        { x: 220, y: 124 },
        { x: 360, y: 124 },
        { x: 500, y: 180 },
        { x: 640, y: 180 },
        { x: 780, y: 124 },
      ],
    })
    const context = createBenchContext(createModelerModel({ elements: [source, target, flow], selection: [flow.id] }))
    const started = performance.now()
    let hitCount = 0
    for (let index = 0; index < 10_000; index += 1) {
      const optimized = MODEL_ELEMENTS_RUNTIME.routeOptimizer.optimizeWaypoints(context, flow, flow.waypoints)
      const handle = MODEL_ELEMENTS_RUNTIME.edges.createSegmentHandleAtPoint(context, {
        ...flow,
        waypoints: optimized,
      }, { x: 200 + (index % 600), y: 124 + (index % 3) })
      if (handle) hitCount += 1
    }
    expect(hitCount).toBeGreaterThan(0)
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('keeps large BPMN structural validation bounded', () => {
    const model = createModelerModel({ elements: createLargeValidBpmnElements(10_000, 10_000) })
    const started = performance.now()
    const result = BpmnValidationRuntime.validate(model)
    expect(result.status).toBe('valid')
    expect(performance.now() - started).toBeLessThan(250)
  })

  it('keeps repeated small BPMN structural validation bounded', () => {
    const elements = createSmallValidBpmnElements()
    const started = performance.now()
    let validCount = 0
    for (let index = 0; index < 1_000; index += 1) {
      const result = BpmnValidationRuntime.validate(createModelerModel({ elements, version: index }))
      if (result.status === 'valid') validCount += 1
    }
    expect(validCount).toBe(1_000)
    expect(performance.now() - started).toBeLessThan(120)
  })

  it('keeps BPMN validation plugin debounce bounded during rapid model updates', () => {
    vi.useFakeTimers()
    const validate = vi.fn(BpmnValidationRuntime.validate)
    const controller = createModelerController({
      model: createModelerModel({ elements: createSmallValidBpmnElements() }),
      pluginRuntime: createPluginRuntime().use(BpmnValidationPlugin.create({ debounceMs: 150, validate })),
    })
    controller.mount(createBenchHost(1200, 800))
    const task = controller.getModel().elements.find(element => element.id === 'task')!
    const started = performance.now()
    for (let index = 0; index < 1_000; index += 1) {
      controller.applyCommand({ type: 'element.patch', id: task.id, patch: { x: 220 + index } })
    }
    expect(validate).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(150)
    expect(validate).toHaveBeenCalledTimes(2)
    expect(performance.now() - started).toBeLessThan(600)
    controller.unmount()
    vi.useRealTimers()
  })
})

function createBenchHost(width: number, height: number) {
  return {
    id: 'bench-host',
    app: {
      raph: {
        kernel: {
          set: () => {},
          notify: () => {},
          transaction: (fn: () => void) => fn(),
        },
      },
    } as never,
    width,
    height,
    invalidate: () => {},
    onModelCommit: () => {},
    layers: {
      get: () => { throw new Error('not used') },
      mount: () => { throw new Error('not used') },
      unmount: () => {},
      reconcile: () => () => {},
    },
  }
}

function createBenchContext(model: ModelerModel): ModelerPluginContext {
  const viewport: ModelerViewport = { x: 0, y: 0, scale: 1 }
  const registry = createModelerElementRegistry()
  return {
    getModel: () => model,
    getViewport: () => viewport,
    getElementRegistry: () => registry,
    worldToScreen: point => ({ x: point.x * viewport.scale + viewport.x, y: point.y * viewport.scale + viewport.y }),
    screenToWorld: point => ({ x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale }),
    getOptions: () => ({}),
  } as ModelerPluginContext
}

function createSmallValidBpmnElements() {
  return [
    createBpmnEventElement({ id: 'start', x: 100, y: 100, eventPosition: 'start' }),
    createBpmnTaskElement({ id: 'task', x: 220, y: 84 }),
    createBpmnEventElement({ id: 'end', x: 400, y: 100, eventPosition: 'end' }),
    createBpmnFlowElement({
      id: 'flow-start-task',
      source: { elementId: 'start', point: { x: 148, y: 124 } },
      target: { elementId: 'task', point: { x: 220, y: 124 } },
    }),
    createBpmnFlowElement({
      id: 'flow-task-end',
      source: { elementId: 'task', point: { x: 340, y: 124 } },
      target: { elementId: 'end', point: { x: 400, y: 124 } },
    }),
  ]
}

function createSparseBpmnRecipeNodes(count: number): Array<ModelerElement> {
  return Array.from({ length: count }, (_item, index) => {
    const x = (index % 160) * 190
    const y = Math.floor(index / 160) * 130
    if (index % 3 === 0) return createBpmnTaskElement({ id: `recipe-node-${index}`, x, y, name: `Task ${index}` })
    if (index % 3 === 1) return createBpmnEventElement({ id: `recipe-node-${index}`, x, y })
    return createBpmnGatewayElement({ id: `recipe-node-${index}`, x, y })
  })
}

function createSparseBpmnRecipeEdges(count: number, nodes: ReadonlyArray<ModelerElement>): Array<ModelerElement> {
  return Array.from({ length: count }, (_item, index) => {
    const source = nodes[index % nodes.length]!
    const target = nodes[(index * 37 + 11) % nodes.length]!
    return createBpmnFlowElement({
      id: `recipe-flow-${index}`,
      source: { elementId: source.id, point: { x: source.x + source.width, y: source.y + source.height / 2 } },
      target: { elementId: target.id, point: { x: target.x, y: target.y + target.height / 2 } },
      waypoints: [
        { x: source.x + source.width + 48, y: source.y + source.height / 2 },
        { x: target.x - 48, y: target.y + target.height / 2 },
      ],
    })
  })
}

function createVisibilityLayout(viewport: ModelerViewport, width: number, height: number): ModelerLayout {
  return {
    width,
    height,
    viewport,
    canvas: { x: 0, y: 0, width, height },
    worldBounds: { x: 0, y: 0, width: 30_000, height: 30_000 },
  }
}

function createVisibilityClassifier() {
  return {
    isEdge: (element: { source?: unknown; target?: unknown }) => Boolean(element.source && element.target),
    isRecipeNodeType: isBpmnRecipeNodeType,
    isRecipeRenderable: isBpmnRecipeRenderableNode,
  }
}

function writeRecipeNodePayload(runtime: BpmnBatchRuntime, nodes: ReadonlyArray<ModelerElement>): void {
  const writers = runtime.begin()
  for (const node of nodes) {
    const rect: ModelerRect = { x: node.x, y: node.y, width: node.width, height: node.height }
    if (node.type === 'bpmn.task') {
      writers.fill.write(node.id, 'activity-fill', rect, '#ffffff')
      writers.text.write(node.id, 'activity-label', String(node.data?.name ?? 'Task'), {
        x: rect.x + 8,
        y: rect.y + 4,
        width: Math.max(1, rect.width - 16),
        height: Math.max(1, rect.height - 8),
      })
    }
  }
  runtime.finalize({
    recipeElements: nodes.length,
    visibleElements: nodes.length,
    culledElements: 0,
    schemaFallbacks: 0,
    schemaItems: 0,
    textEnabled: true,
    textColor: '#172033',
  })
}

function createLargeValidBpmnElements(nodeCount: number, flowCount: number) {
  const nodes = Array.from({ length: nodeCount }, (_item, index) => {
    const x = (index % 100) * 180
    const y = Math.floor(index / 100) * 120
    if (index === 0) return createBpmnEventElement({ id: 'node-0', x, y, eventPosition: 'start' })
    if (index === nodeCount - 1) return createBpmnEventElement({ id: `node-${index}`, x, y, eventPosition: 'end' })
    if (index % 2 === 0) return createBpmnTaskElement({ id: `node-${index}`, x, y })
    return createBpmnGatewayElement({ id: `node-${index}`, x, y })
  })
  const flows = Array.from({ length: flowCount }, (_item, index) => {
    const sourceIndex = index < nodeCount - 1 ? index : 0
    const targetIndex = index < nodeCount - 1 ? index + 1 : 1
    return createBpmnFlowElement({
      id: `validation-flow-${index}`,
      source: { elementId: `node-${sourceIndex}`, point: { x: 0, y: 0 } },
      target: { elementId: `node-${targetIndex}`, point: { x: 0, y: 0 } },
    })
  })
  return [...nodes, ...flows]
}
