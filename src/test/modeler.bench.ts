import { describe, expect, it, vi } from 'vitest'
import {
  BpmnValidationPlugin,
  BpmnValidationRuntime,
  MiniMapPlugin,
  MODEL_ELEMENTS_RUNTIME,
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
} from '@/index'
import type { NovaSchema } from '@endge/nova'
import type { ModelerModel, ModelerPluginContext, ModelerViewport } from '@/index'

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
