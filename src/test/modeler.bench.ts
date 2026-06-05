import { describe, expect, it, vi } from 'vitest'
import {
  Nova,
  RaphSchedulerType,
  RendererType,
  type NovaSchema,
} from '@endge/nova'
import insuranceClaimDemoModel from '../../../../insurance-bpmn-full.json'
import {
  BpmnBatchRuntime,
  BpmnValidationPlugin,
  BpmnValidationRuntime,
  Grid,
  MiniMapPlugin,
  MODEL_ELEMENTS_RUNTIME,
  Modeler,
  ModelerVisibilityRuntime,
  appendGridSchema,
  createBpmnEventElement,
  createBpmnFlowElement,
  createBpmnGatewayElement,
  createBpmnParticipantElement,
  createBpmnTaskElement,
  createPluginRuntime,
  createModelerElementRegistry,
  createGridRenderPlan,
  createModelerController,
  createModelerModel,
  isBpmnRecipeNodeType,
  isBpmnRecipeRenderableNode,
  registerModeler,
  type Root,
} from '@/index'
import type { ModelerElement, ModelerLayout, ModelerModel, ModelerModelInput, ModelerPluginContext, ModelerRect, ModelerViewport } from '@/index'

const diagnosticsIt = isDiagnosticsBenchEnabled() ? it : it.skip

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

  it('keeps insurance-like swimlane pan and zoom retained', () => {
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:nova-modeler-bench')
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createBench2DContextStub())
    const participants = createInsuranceLikeParticipants()
    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 2560, height: 1440, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'insurance-like-retained-root',
      props: {
        model: createModelerModel({
          canvas: { x: -1000, y: -1000, width: 9000, height: 5200 },
          viewport: { x: 0, y: 0, scale: 1.8 },
          elements: participants,
        }),
        width: 2560,
        height: 1440,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const containers = app.surfaces.find(item => item.name === 'insurance-like-retained-root:containers')
    if (!containers) throw new Error('containers layer not mounted')
    containers.compileRenderFrame()
    const recipeLayer = app.components.require('modeler-elements:bpmn-container-recipe-layer') as unknown as {
      render: () => void
      batchRuntime: { getFillBatch(): { revision?: number } }
    }
    const firstFillRevision = recipeLayer.batchRuntime.getFillBatch().revision
    const renderSpy = vi.spyOn(recipeLayer, 'render')
    for (const participant of participants) {
      expect(app.components.get(`${participant.id}:view`)).toBeUndefined()
    }

    const started = performance.now()
    let totalNodeRenderCalls = 0
    let maxCompilerMs = 0
    for (let frame = 0; frame < 120; frame += 1) {
      root.getApi().setViewport({
        x: -frame * 17,
        y: frame * 9,
        scale: 1.8 + (frame % 5) * 0.04,
      })
      app.raph.run()
      const metrics = containers.renderMetrics
      totalNodeRenderCalls += metrics?.nodeRenderCalls ?? 0
      maxCompilerMs = Math.max(maxCompilerMs, metrics?.compilerMs ?? 0)
    }
    const elapsed = performance.now() - started

    expect(renderSpy.mock.calls.length).toBeLessThanOrEqual(10)
    expect(recipeLayer.batchRuntime.getFillBatch().revision).toBeGreaterThanOrEqual(firstFillRevision ?? 0)
    expect(totalNodeRenderCalls).toBeLessThanOrEqual(20)
    expect(maxCompilerMs).toBeLessThan(1)
    expect(elapsed).toBeLessThan(900)
    app.destroy()
  })

  it('keeps the full insurance BPMN demo pan and zoom on retained recipe layers', () => {
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:nova-modeler-bench')
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createBench2DContextStub())
    const demoModel = createModelerModel({
      ...(insuranceClaimDemoModel as unknown as ModelerModelInput),
      viewport: { x: -840, y: -320, scale: 1.88 },
      selection: [],
    })
    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 2048, height: 1240, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'full-insurance-retained-root',
      props: {
        model: demoModel,
        width: 2048,
        height: 1240,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const containers = app.surfaces.find(item => item.name === 'full-insurance-retained-root:containers')
    const interaction = app.surfaces.find(item => item.name === 'full-insurance-retained-root:interaction')
    if (!containers || !interaction) throw new Error('modeler layers not mounted')
    containers.compileRenderFrame()
    interaction.compileRenderFrame()
    const containerRecipeLayer = app.components.require('modeler-elements:bpmn-container-recipe-layer') as unknown as {
      render: () => void
    }
    const nodeRecipeLayer = app.components.require('modeler-elements:bpmn-recipe-layer') as unknown as {
      render: () => void
    }
    const containerRenderSpy = vi.spyOn(containerRecipeLayer, 'render')
    const nodeRenderSpy = vi.spyOn(nodeRecipeLayer, 'render')

    const started = performance.now()
    let totalNodeRenderCalls = 0
    let maxCompilerMs = 0
    for (let frame = 0; frame < 120; frame += 1) {
      root.getApi().setViewport({
        x: -840 - frame * 9,
        y: -320 + frame * 5,
        scale: 1.84 + (frame % 5) * 0.02,
      })
      app.raph.run()
      for (const layer of [containers, interaction]) {
        const metrics = layer.renderMetrics
        totalNodeRenderCalls += metrics?.nodeRenderCalls ?? 0
        maxCompilerMs = Math.max(maxCompilerMs, metrics?.compilerMs ?? 0)
      }
    }
    const elapsed = performance.now() - started

    expect(containerRenderSpy.mock.calls.length).toBeLessThanOrEqual(10)
    expect(nodeRenderSpy.mock.calls.length).toBeLessThanOrEqual(60)
    expect(totalNodeRenderCalls).toBeLessThanOrEqual(300)
    expect(maxCompilerMs).toBeLessThan(4)
    expect(elapsed).toBeLessThan(6500)
    app.destroy()
  })

  diagnosticsIt('diagnoses full insurance data stages before Nova rendering', () => {
    const viewports = createInsuranceDiagnosticViewports()
    const model = createFullInsuranceBenchModel(viewports[0]!)
    const visibility = new ModelerVisibilityRuntime()
    const edgeContext = createBenchContext(model)
    const recipeRuntime = new BpmnBatchRuntime()
    const visibilitySamples: Array<number> = []
    const edgeRouteSamples: Array<number> = []
    const recipeBatchSamples: Array<number> = []
    let visibleNodesTotal = 0
    let visibleEdgesTotal = 0
    let recipeNodesTotal = 0
    let edgePathCalls = 0
    let signatureChanges = 0
    let previousSignature = ''

    for (let frame = 0; frame < viewports.length; frame += 1) {
      const viewport = viewports[frame]!
      const frameModel = {
        ...model,
        viewport,
        viewportVersion: frame,
      }
      const visibilityStarted = performance.now()
      const snapshot = visibility.resolve({
        model: frameModel,
        layout: createVisibilityLayout(viewport, 2048, 1240),
        viewport,
        useBpmnRecipes: true,
        recipeCulling: true,
        classifier: createVisibilityClassifier(),
      })
      visibilitySamples.push(performance.now() - visibilityStarted)
      visibleNodesTotal += snapshot.nodes.length
      visibleEdgesTotal += snapshot.edges.length
      recipeNodesTotal += snapshot.recipeNodes.length
      if (snapshot.signature !== previousSignature) {
        signatureChanges += 1
        previousSignature = snapshot.signature
      }

      const edgeStarted = performance.now()
      for (const edge of snapshot.edges) {
        MODEL_ELEMENTS_RUNTIME.edges.createPath(edgeContext, edge as never)
        edgePathCalls += 1
      }
      edgeRouteSamples.push(performance.now() - edgeStarted)

      const recipeStarted = performance.now()
      writeRecipeNodePayload(recipeRuntime, snapshot.recipeNodes)
      recipeBatchSamples.push(performance.now() - recipeStarted)
    }

    const report = {
      elements: model.elements.length,
      frames: viewports.length,
      visibility: {
        ...summarizeSamples(visibilitySamples),
        signatureChanges,
        avgVisibleNodes: round(visibleNodesTotal / viewports.length),
        avgVisibleEdges: round(visibleEdgesTotal / viewports.length),
        avgRecipeNodes: round(recipeNodesTotal / viewports.length),
        diagnostics: visibility.getDiagnostics(),
      },
      edgeRouting: {
        ...summarizeSamples(edgeRouteSamples),
        edgePathCalls,
      },
      recipeBatchWrite: {
        ...summarizeSamples(recipeBatchSamples),
        diagnostics: recipeRuntime.getDiagnostics(),
      },
    }
    console.info(`\n[nova-modeler diagnostics:data]\n${JSON.stringify(report, null, 2)}`)

    expect(report.elements).toBe(167)
    expect(report.visibility.diagnostics.indexRebuilds).toBe(1)
    expect(report.visibility.signatureChanges).toBeGreaterThan(1)
    expect(report.edgeRouting.edgePathCalls).toBeGreaterThan(0)
    expect(report.visibility.totalMs).toBeLessThan(500)
    expect(report.edgeRouting.totalMs).toBeLessThan(500)
    expect(report.recipeBatchWrite.totalMs).toBeLessThan(500)
  })

  diagnosticsIt('diagnoses full insurance viewport commit levels', () => {
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:nova-modeler-bench')
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createBench2DContextStub())
    const viewports = createInsuranceDiagnosticViewports(60)
    const model = createFullInsuranceBenchModel(viewports[0]!)

    const fakeHostController = createModelerController({ model })
    fakeHostController.mount(createBenchHost(2048, 1240))
    const fakeHostSamples = measureViewportCommits(viewports, viewport => {
      fakeHostController.setViewport(viewport)
    })
    fakeHostController.unmount()

    const realStoreApp = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 2048, height: 1240, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    const realStoreController = createModelerController({ model })
    const realStoreHost = createBenchHost(2048, 1240) as ReturnType<typeof createBenchHost> & { app: typeof realStoreApp }
    realStoreHost.app = realStoreApp
    realStoreController.mount(realStoreHost)
    const realStoreSamples = measureViewportCommits(viewports, viewport => {
      realStoreController.setViewport(viewport)
    })
    realStoreController.unmount()
    realStoreApp.destroy()

    const rootApp = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 2048, height: 1240, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(rootApp.schema)
    const surface = rootApp.createSurface('modeler')
    const root = rootApp.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'full-insurance-commit-root',
      props: {
        model,
        width: 2048,
        height: 1240,
      },
    }) as Root
    rootApp.raph.run()
    rootApp.raph.run()
    const rootSamples = measureViewportCommits(viewports, viewport => {
      root.getApi().setViewport(viewport)
    })
    rootApp.destroy()

    const report = {
      frames: viewports.length,
      controllerFakeHost: summarizeSamples(fakeHostSamples),
      controllerRealNovaStore: summarizeSamples(realStoreSamples),
      fullRootApi: summarizeSamples(rootSamples),
    }
    console.info(`\n[nova-modeler diagnostics:viewport-commit]\n${JSON.stringify(report, null, 2)}`)

    expect(report.frames).toBe(60)
    expect(report.controllerFakeHost.totalMs).toBeGreaterThan(0)
    expect(report.controllerRealNovaStore.totalMs).toBeGreaterThan(0)
    expect(report.fullRootApi.totalMs).toBeGreaterThan(0)
    expect(report.fullRootApi.totalMs).toBeGreaterThan(report.controllerFakeHost.totalMs)
  })

  diagnosticsIt('diagnoses full insurance controller setViewport internals', () => {
    const viewports = createInsuranceDiagnosticViewports(60)
    const controller = createModelerController({ model: createFullInsuranceBenchModel(viewports[0]!) })
    controller.mount(createBenchHost(2048, 1240))
    const target = controller as unknown as {
      store: {
        setViewport: (...args: Array<unknown>) => unknown
        getModel: (...args: Array<unknown>) => unknown
      }
      recomputeLayout: (...args: Array<unknown>) => unknown
      createLayout: (...args: Array<unknown>) => unknown
      resolveWorldBounds: (...args: Array<unknown>) => unknown
      resolveEdgeWorldBounds: (...args: Array<unknown>) => unknown
      resolveExternalLabelWorldBounds: (...args: Array<unknown>) => unknown
      afterModelCommit: (...args: Array<unknown>) => unknown
      clampViewport: (...args: Array<unknown>) => unknown
    }
    const instruments = [
      instrumentMethod(target, 'clampViewport'),
      instrumentMethod(target.store, 'setViewport'),
      instrumentMethod(target.store, 'getModel'),
      instrumentMethod(target, 'afterModelCommit'),
      instrumentMethod(target, 'recomputeLayout'),
      instrumentMethod(target, 'createLayout'),
      instrumentMethod(target, 'resolveWorldBounds'),
      instrumentMethod(target, 'resolveEdgeWorldBounds'),
      instrumentMethod(target, 'resolveExternalLabelWorldBounds'),
    ]
    const setViewportSamples = measureViewportCommits(viewports, viewport => {
      controller.setViewport(viewport)
    })
    const report = {
      frames: viewports.length,
      setViewport: summarizeSamples(setViewportSamples),
      internals: instruments.map(instrument => instrument.report()),
    }
    console.info(`\n[nova-modeler diagnostics:controller-internals]\n${JSON.stringify(report, null, 2)}`)

    for (const instrument of instruments) instrument.restore()
    controller.unmount()

    expect(report.frames).toBe(60)
    expect(report.setViewport.totalMs).toBeGreaterThan(0)
    expect(report.internals.find(item => item.name === 'recomputeLayout')?.calls).toBe(0)
    expect(report.internals.find(item => item.name === 'createLayout')?.calls).toBe(0)
    expect(report.internals.find(item => item.name === 'resolveWorldBounds')?.calls).toBe(0)
    expect(report.internals.find(item => item.name === 'resolveExternalLabelWorldBounds')?.calls).toBe(0)
  })

  diagnosticsIt('diagnoses full insurance Nova runtime stages by surface', () => {
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:nova-modeler-bench')
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createBench2DContextStub())
    const viewports = createInsuranceDiagnosticViewports(60)
    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 2048, height: 1240, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'full-insurance-stage-root',
      props: {
        model: createFullInsuranceBenchModel(viewports[0]!),
        width: 2048,
        height: 1240,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const compileInstrumentation = instrumentSurfaceCompile(app.surfaces)
    const backendInstrumentation = instrumentBackendReplay(app)
    const containerRecipeLayer = app.components.require('modeler-elements:bpmn-container-recipe-layer') as unknown as {
      render: () => void
      batchRuntime: BpmnBatchRuntime
    }
    const nodeRecipeLayer = app.components.require('modeler-elements:bpmn-recipe-layer') as unknown as {
      render: () => void
      batchRuntime: BpmnBatchRuntime
    }
    const containerRenderSpy = vi.spyOn(containerRecipeLayer, 'render')
    const nodeRenderSpy = vi.spyOn(nodeRecipeLayer, 'render')
    const setViewportSamples: Array<number> = []
    const raphSamples: Array<number> = []
    const dirtySurfaceCounts: Array<number> = []

    for (let frame = 0; frame < viewports.length; frame += 1) {
      const viewport = viewports[frame]!
      const setStarted = performance.now()
      root.getApi().setViewport(viewport)
      setViewportSamples.push(performance.now() - setStarted)
      dirtySurfaceCounts.push(app.dirtySurfaceCount)

      const raphStarted = performance.now()
      app.raph.run()
      raphSamples.push(performance.now() - raphStarted)
    }

    const surfaceMetrics = summarizeSurfaceRenderMetrics(app.surfaces)
    const report = {
      frames: viewports.length,
      setViewport: summarizeSamples(setViewportSamples),
      raphRun: summarizeSamples(raphSamples),
      dirtySurfacesBeforeRun: summarizeNumberSeries(dirtySurfaceCounts),
      surfaceCompile: compileInstrumentation.report(),
      backendReplay: backendInstrumentation.report(),
      surfaceRenderMetrics: surfaceMetrics,
      recipeLayers: {
        containerRenderCalls: containerRenderSpy.mock.calls.length,
        nodeRenderCalls: nodeRenderSpy.mock.calls.length,
        containerDiagnostics: containerRecipeLayer.batchRuntime.getDiagnostics(),
        nodeDiagnostics: nodeRecipeLayer.batchRuntime.getDiagnostics(),
      },
    }
    console.info(`\n[nova-modeler diagnostics:runtime]\n${JSON.stringify(report, null, 2)}`)

    compileInstrumentation.restore()
    backendInstrumentation.restore()
    app.destroy()

    expect(report.frames).toBe(60)
    expect(report.recipeLayers.containerRenderCalls).toBeLessThanOrEqual(1)
    expect(report.recipeLayers.nodeRenderCalls).toBeLessThanOrEqual(1)
    expect(report.surfaceCompile.length).toBeGreaterThan(0)
    expect(report.backendReplay.total.calls).toBeGreaterThan(0)
    expect(report.raphRun.totalMs).toBeLessThan(10_000)
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

function isDiagnosticsBenchEnabled(): boolean {
  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process
    ?.env
    ?.NOVA_MODELER_DIAGNOSTICS === '1'
}

function createInsuranceLikeParticipants(): Array<ModelerElement> {
  return Array.from({ length: 5 }, (_item, participantIndex) => createBpmnParticipantElement({
    id: `insurance-pool-${participantIndex}`,
    x: 120,
    y: 120 + participantIndex * 760,
    width: 5200,
    height: 720,
    name: `Insurance process ${participantIndex + 1}`,
    lanes: [
      {
        id: `insurance-pool-${participantIndex}:lane-a`,
        name: participantIndex % 2 === 0 ? 'Customer operations' : 'Policy operations',
        size: 360,
        style: { fill: participantIndex % 2 === 0 ? '#f8fafc' : '#f0fdf4' },
      },
      {
        id: `insurance-pool-${participantIndex}:lane-b`,
        name: participantIndex % 2 === 0 ? 'Claims office' : 'Risk office',
        size: 360,
        style: { fill: participantIndex % 2 === 0 ? '#eff6ff' : '#fff7ed' },
      },
    ],
  }))
}

function createBench2DContextStub(): CanvasRenderingContext2D {
  return {
    canvas: document.createElement('canvas'),
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 7 })) as unknown as CanvasRenderingContext2D['measureText'],
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createPattern: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    getLineDash: vi.fn(() => []),
    setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

function createFullInsuranceBenchModel(viewport: ModelerViewport): ModelerModel {
  return createModelerModel({
    ...(insuranceClaimDemoModel as unknown as ModelerModelInput),
    viewport,
    selection: [],
  })
}

function createInsuranceDiagnosticViewports(frames = 120): Array<ModelerViewport> {
  return Array.from({ length: frames }, (_item, frame) => ({
    x: -840 - frame * 9,
    y: -320 + frame * 5,
    scale: 1.84 + (frame % 5) * 0.02,
  }))
}

function summarizeSamples(samples: Array<number>) {
  const totalMs = samples.reduce((total, value) => total + value, 0)
  const maxMs = samples.length > 0 ? Math.max(...samples) : 0
  const avgMs = samples.length > 0 ? totalMs / samples.length : 0
  return {
    frames: samples.length,
    totalMs: round(totalMs),
    avgMs: round(avgMs),
    maxMs: round(maxMs),
  }
}

function summarizeNumberSeries(values: Array<number>) {
  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    frames: values.length,
    avg: round(values.length > 0 ? total / values.length : 0),
    max: values.length > 0 ? Math.max(...values) : 0,
    min: values.length > 0 ? Math.min(...values) : 0,
  }
}

function measureViewportCommits(viewports: ReadonlyArray<ModelerViewport>, commit: (viewport: ModelerViewport) => void): Array<number> {
  return viewports.map(viewport => {
    const started = performance.now()
    commit(viewport)
    return performance.now() - started
  })
}

function instrumentMethod<T extends Record<string, any>>(target: T, methodName: keyof T & string) {
  const original = target[methodName]
  if (typeof original !== 'function') throw new Error(`Cannot instrument missing method ${methodName}`)
  const samples: Array<number> = []
  let calls = 0
  target[methodName] = function instrumentedMethod(this: unknown, ...args: Array<unknown>) {
    const started = performance.now()
    try {
      return original.apply(this, args)
    } finally {
      calls += 1
      samples.push(performance.now() - started)
    }
  } as T[typeof methodName]

  return {
    report: () => ({
      name: methodName,
      calls,
      ...summarizeSamples(samples),
    }),
    restore: () => {
      target[methodName] = original
    },
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function instrumentSurfaceCompile(surfaces: Array<{ name: string; compileRenderFrame: () => { metrics?: Record<string, number> } }>) {
  const entries = new Map<string, {
    calls: number
    wallSamples: Array<number>
    compilerMs: number
    nodeRenderCalls: number
    commands: number
    items: number
    groups: number
  }>()
  const restorers: Array<() => void> = []

  for (const surface of surfaces) {
    const original = surface.compileRenderFrame.bind(surface)
    entries.set(surface.name, {
      calls: 0,
      wallSamples: [],
      compilerMs: 0,
      nodeRenderCalls: 0,
      commands: 0,
      items: 0,
      groups: 0,
    })
    surface.compileRenderFrame = () => {
      const started = performance.now()
      const frame = original()
      const elapsed = performance.now() - started
      const entry = entries.get(surface.name)!
      entry.calls += 1
      entry.wallSamples.push(elapsed)
      entry.compilerMs += frame.metrics?.compilerMs ?? 0
      entry.nodeRenderCalls += frame.metrics?.nodeRenderCalls ?? 0
      entry.commands += frame.metrics?.commands ?? 0
      entry.items += frame.metrics?.items ?? 0
      entry.groups += frame.metrics?.groups ?? 0
      return frame
    }
    restorers.push(() => {
      surface.compileRenderFrame = original
    })
  }

  return {
    report: () => [...entries.entries()].map(([name, entry]) => ({
      name,
      calls: entry.calls,
      wall: summarizeSamples(entry.wallSamples),
      compilerMs: round(entry.compilerMs),
      avgCompilerMs: round(entry.calls > 0 ? entry.compilerMs / entry.calls : 0),
      nodeRenderCalls: entry.nodeRenderCalls,
      commands: entry.commands,
      items: entry.items,
      groups: entry.groups,
    })),
    restore: () => {
      for (const restore of restorers) restore()
    },
  }
}

function instrumentBackendReplay(app: unknown) {
  const backend = (app as { _backend: { renderFrame: (frame: { surfaceId: string }) => Record<string, number> } })._backend
  const original = backend.renderFrame.bind(backend)
  const totalSamples: Array<number> = []
  const bySurface = new Map<string, {
    calls: number
    wallSamples: Array<number>
    backendMs: number
    drawMs: number
    uploadMs: number
    drawCalls: number
    batches: number
    commands: number
    items: number
    textRasterMs: number
    atlasUploads: number
    bufferDataCalls: number
    bufferSubDataCalls: number
  }>()

  backend.renderFrame = (frame) => {
    const started = performance.now()
    const metrics = original(frame)
    const elapsed = performance.now() - started
    totalSamples.push(elapsed)
    const key = frame.surfaceId
    const entry = bySurface.get(key) ?? {
      calls: 0,
      wallSamples: [],
      backendMs: 0,
      drawMs: 0,
      uploadMs: 0,
      drawCalls: 0,
      batches: 0,
      commands: 0,
      items: 0,
      textRasterMs: 0,
      atlasUploads: 0,
      bufferDataCalls: 0,
      bufferSubDataCalls: 0,
    }
    entry.calls += 1
    entry.wallSamples.push(elapsed)
    entry.backendMs += metrics.backendMs ?? 0
    entry.drawMs += metrics.drawMs ?? 0
    entry.uploadMs += metrics.uploadMs ?? 0
    entry.drawCalls += metrics.drawCalls ?? 0
    entry.batches += metrics.batches ?? 0
    entry.commands += metrics.commands ?? 0
    entry.items += metrics.items ?? 0
    entry.textRasterMs += metrics.textRasterMs ?? 0
    entry.atlasUploads += metrics.atlasUploads ?? 0
    entry.bufferDataCalls += metrics.bufferDataCalls ?? 0
    entry.bufferSubDataCalls += metrics.bufferSubDataCalls ?? 0
    bySurface.set(key, entry)
    return metrics
  }

  return {
    report: () => ({
      total: {
        calls: totalSamples.length,
        ...summarizeSamples(totalSamples),
      },
      bySurface: [...bySurface.entries()].map(([name, entry]) => ({
        name,
        calls: entry.calls,
        wall: summarizeSamples(entry.wallSamples),
        backendMs: round(entry.backendMs),
        avgBackendMs: round(entry.calls > 0 ? entry.backendMs / entry.calls : 0),
        drawMs: round(entry.drawMs),
        uploadMs: round(entry.uploadMs),
        drawCalls: entry.drawCalls,
        batches: entry.batches,
        commands: entry.commands,
        items: entry.items,
        textRasterMs: round(entry.textRasterMs),
        atlasUploads: entry.atlasUploads,
        bufferDataCalls: entry.bufferDataCalls,
        bufferSubDataCalls: entry.bufferSubDataCalls,
      })),
    }),
    restore: () => {
      backend.renderFrame = original
    },
  }
}

function summarizeSurfaceRenderMetrics(surfaces: Array<{ name: string; renderMetrics: Record<string, number> | null }>) {
  return surfaces.map(surface => {
    const metrics = surface.renderMetrics ?? {}
    return {
      name: surface.name,
      compilerMs: round(metrics.compilerMs ?? 0),
      backendMs: round(metrics.backendMs ?? 0),
      drawMs: round(metrics.drawMs ?? 0),
      uploadMs: round(metrics.uploadMs ?? 0),
      nodeRenderCalls: metrics.nodeRenderCalls ?? 0,
      commands: metrics.commands ?? 0,
      items: metrics.items ?? 0,
      groups: metrics.groups ?? 0,
      drawCalls: metrics.drawCalls ?? 0,
      batches: metrics.batches ?? 0,
      textRasterMs: round(metrics.textRasterMs ?? 0),
      textRasterCount: metrics.textRasterCount ?? 0,
      textCacheHits: metrics.textCacheHits ?? 0,
      textCacheMisses: metrics.textCacheMisses ?? 0,
      fullUploads: metrics.fullUploads ?? 0,
      bufferDataCalls: metrics.bufferDataCalls ?? 0,
      bufferSubDataCalls: metrics.bufferSubDataCalls ?? 0,
    }
  })
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
