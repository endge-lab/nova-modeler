import { describe, expect, it, vi } from 'vitest'
import { Nova, RaphSchedulerType, RendererType, boundsContainsPoint, type NovaSchema } from '@endge/nova'
import { NovaUIKit } from '@endge/nova-ui-kit'
import {
  Modeler,
  MarqueeSelectionPlugin,
  MiniMapPlugin,
  Root,
  applyModelerCommand,
  appendGridSchema,
  createGridRenderPlan,
  createModelerController,
  createModelerModel,
  createPluginRuntime,
  MODELER_LAYER_NAMES,
  PluginBase,
  normalizeModelerModel,
  registerModeler,
} from '@/index'

describe('nova modeler minimal kernel', () => {
  it('creates and mutates viewport-only model', () => {
    const model = createModelerModel({ id: 'demo', viewport: { scale: 1.5 }, canvas: { width: 5000 } })
    expect(model.id).toBe('demo')
    expect(model.viewport.scale).toBe(1.5)
    expect(model.canvas.width).toBe(5000)
    const next = applyModelerCommand(model, { type: 'setViewport', viewport: { x: 42 } })
    expect(next.viewport).toMatchObject({ x: 42, scale: 1.5 })
    expect(next.viewportVersion).toBe(1)
    const selected = applyModelerCommand(next, { type: 'select', ids: ['a'] })
    expect(selected.selection).toEqual(['a'])
    expect(normalizeModelerModel({ ...selected, version: 10, viewportVersion: 11, selectionVersion: 12 })).toMatchObject({
      version: 10,
      viewportVersion: 11,
      selectionVersion: 12,
    })
    expect(normalizeModelerModel({ id: 'bare' })).toMatchObject({
      version: 0,
      viewportVersion: 0,
      selectionVersion: 0,
    })
  })

  it('computes layout, hit-test and viewport clamp', () => {
    const model = createModelerModel({ canvas: { x: -100, y: -100, width: 200, height: 200 }, viewport: { x: 0, y: 0, scale: 1 } })
    const controller = createModelerController({ model })
    controller.mount(createControllerHost(100, 100))
    expect(controller.hitTest({ x: 50, y: 50 })).toEqual({ type: 'canvas' })
    expect(controller.hitTest({ x: -1, y: 50 })).toEqual({ type: 'empty' })
    expect(controller.setViewport({ x: 1000, y: -1000, scale: 1 }).viewport).toEqual({ x: 100, y: 0, scale: 1 })
    expect(controller.screenToWorld({ x: 10, y: 10 })).toEqual({ x: -90, y: 10 })
    expect(controller.worldToScreen({ x: -90, y: 10 })).toEqual({ x: 10, y: 10 })
    expect(controller.fitView().scale).toBeGreaterThan(0)
    expect(boundsContainsPoint({ x: 0, y: 0, width: 10, height: 10 }, 5, 5)).toBe(true)
    expect(boundsContainsPoint({ x: 0, y: 0, width: 10, height: 10 }, 15, 5)).toBe(false)
  })

  it('keeps controller store as reactive source of truth', () => {
    const controller = createModelerController({
      model: createModelerModel({ viewport: { scale: 1.25 }, selection: ['old'] }),
    })
    controller.mount(createControllerHost(320, 200))

    expect(controller.store.viewport.scale).toBe(1.25)
    expect(controller.store.selection.ids).toEqual(['old'])

    controller.setViewport({ scale: 1.75 })
    expect(controller.store.viewport.scale).toBe(1.75)
    expect(controller.getModel().viewport.scale).toBe(1.75)

    controller.applyCommand({ type: 'select', ids: ['next'] })
    expect(controller.store.selection.ids).toEqual(['next'])
    expect(controller.getModel().selection).toEqual(['next'])
  })

  it('keeps dot grid render plan bounded on tiny zoom', () => {
    const normal = createGridRenderPlan({
      width: 640,
      height: 420,
      gridSize: 32,
      scale: 1,
      viewportX: 0,
      viewportY: 0,
    })
    expect(normal.spacing).toBe(32)
    expect(normal.radius).toBeGreaterThan(1)
    const tiny = createGridRenderPlan({
      width: 2048,
      height: 1152,
      gridSize: 32,
      scale: 0.1,
      viewportX: -13,
      viewportY: 21,
    })
    expect(tiny.spacing).toBeGreaterThanOrEqual(18)
    expect(tiny.dotCount).toBeLessThanOrEqual(8_000)
    expect(tiny.radius).toBeLessThan(normal.radius)
    expect(tiny.offsetX).toBeGreaterThanOrEqual(0)
    expect(tiny.offsetY).toBeGreaterThanOrEqual(0)

    const capped = createGridRenderPlan({
      width: 6000,
      height: 4000,
      gridSize: 32,
      scale: 0.5,
      viewportX: 0,
      viewportY: 0,
      minScreenSpacing: 4,
      maxDots: 100,
    })
    expect(capped.dotCount).toBeLessThanOrEqual(100)
    const empty = createGridRenderPlan({
      width: 0,
      height: 0,
      gridSize: 32,
      scale: 1,
      viewportX: 0,
      viewportY: 0,
    })
    expect(empty.dotCount).toBe(1)

    const schema = [] as unknown as NovaSchema
    appendGridSchema(schema, tiny, '#94a3b8')
    expect(schema.length).toBeLessThanOrEqual(tiny.dotCount)
  })

  it('registers root and renders grid with minimap plugin', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
        plugins: [MiniMapPlugin.create(), MarqueeSelectionPlugin.create()],
      },
    })
    app.schema.createChild(root, { type: Modeler.ZoomControls, props: { step: 0.2 } })
    app.raph.run()
    expect(root.getApi().getViewport().scale).toBe(1)
    expect(root.getApi().setViewport({ scale: 1.4 }).viewport.scale).toBe(1.4)
    expect(root.getApi().fitView().scale).toBeGreaterThan(0)
  })

  it('creates modeler layer surfaces and cleans them up with root', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'modeler-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
    })

    const layerSurfaceNames = MODELER_LAYER_NAMES.map(name => `modeler-root:${name}`)
    expect(app.surfaces.map(item => item.name)).toEqual(expect.arrayContaining(layerSurfaceNames))

    const controls = app.surfaces.find(item => item.name === 'modeler-root:controls')
    const overlay = app.surfaces.find(item => item.name === 'modeler-root:overlay')
    expect(controls?.interactive).toBe(false)
    expect(overlay?.interactive).toBe(false)

    root.remove()
    expect(app.surfaces.map(item => item.name)).not.toEqual(expect.arrayContaining(layerSurfaceNames))
    app.destroy()
  })

  it('lets named layer slots replace default layer content', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'slot-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
      slots: {
        background: () => [{ type: Modeler.Background, id: 'custom-background' }],
        controls: () => [],
      },
    })

    const background = app.surfaces.find(item => item.name === 'slot-root:background')
    const controls = app.surfaces.find(item => item.name === 'slot-root:controls')
    expect(background?.children).toHaveLength(1)
    expect(controls?.children).toHaveLength(0)
    app.destroy()
  })

  it('routes pointer events to buttons mounted inside the controls layer slot', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const settingsPress = vi.fn()
    const panelPress = vi.fn()
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'controls-click-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
      slots: {
        controls: () => [{
          type: NovaUIKit.Flex,
          id: 'toolbar',
          props: {
            position: 'fixed',
            inset: { top: 16, right: 16 },
            height: 36,
            zIndex: 3000,
          },
          children: [{
            type: NovaUIKit.Button,
            id: 'toolbar-settings',
            props: {
              width: 36,
              height: 36,
              position: 'static',
              onPress: settingsPress,
            },
          }],
        }, {
          type: NovaUIKit.Flex,
          id: 'settings-panel',
          props: {
            position: 'fixed',
            inset: { top: 58, right: 16 },
            padding: { top: 12, right: 12, bottom: 12, left: 12 },
            width: 224,
            height: 284,
            zIndex: 3100,
            col: true,
            gap: 8,
          },
          children: [{
            type: NovaUIKit.TextBlock,
            id: 'panel-label',
            props: {
              width: 200,
              height: 20,
              text: 'Toolbar',
            },
          }, {
            type: NovaUIKit.Button,
            id: 'panel-fps',
            props: {
              position: 'static',
              width: 200,
              height: 30,
              onPress: panelPress,
            },
          }],
        }],
      },
    })
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(606, 34)?.componentId).toBe('toolbar-settings')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 606, clientY: 34, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 606, clientY: 34, button: 0 }))
    expect(settingsPress).toHaveBeenCalledTimes(1)

    expect(app.events.hitTest(500, 113)?.componentId).toBe('panel-fps')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 500, clientY: 113, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 500, clientY: 113, button: 0 }))
    expect(panelPress).toHaveBeenCalledTimes(1)

    expect(['toolbar', 'settings-panel', 'panel-fps']).not.toContain(app.events.hitTest(64, 113)?.componentId)
    app.destroy()
  })

  it('keeps controls slot spatial hit-test in sync after canvas resize', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const settingsPress = vi.fn()
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'controls-resize-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
      slots: {
        controls: () => [{
          type: NovaUIKit.Flex,
          id: 'resize-toolbar',
          props: {
            position: 'fixed',
            inset: { top: 16, right: 16 },
            height: 36,
            zIndex: 3000,
          },
          children: [{
            type: NovaUIKit.Button,
            id: 'resize-toolbar-settings',
            props: {
              width: 36,
              height: 36,
              position: 'static',
              onPress: settingsPress,
            },
          }],
        }],
      },
    }) as Root
    app.raph.run()
    app.raph.run()
    app.setHitTestMode('spatial')

    expect(app.events.hitTest(606, 34)?.componentId).toBe('resize-toolbar-settings')

    app.options({ width: 1898, height: 982 })
    root.setProps({ width: 1898, height: 982 })
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(1864, 34)?.componentId).toBe('resize-toolbar-settings')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 1864, clientY: 34, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 1864, clientY: 34, button: 0 }))
    expect(settingsPress).toHaveBeenCalledTimes(1)
    app.destroy()
  })

  it('does not resync layer slots on render-only dirties', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const controlsSlot = vi.fn(() => [{ type: Modeler.ZoomControls, id: 'stable-toolbar' }])
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'render-dirty-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
      slots: {
        controls: controlsSlot,
      },
    })
    app.raph.run()
    expect(controlsSlot).toHaveBeenCalledTimes(1)

    root.dirty({ render: true })
    app.raph.run()

    expect(controlsSlot).toHaveBeenCalledTimes(1)
    app.destroy()
  })

  it('binds runtime plugins and lets them mount nodes into multiple layers', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const runtime = createPluginRuntime()
      .use(new TestMultiLayerPlugin())
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'runtime-root',
      props: {
        model: createModelerModel(),
        pluginRuntime: runtime,
        width: 640,
        height: 420,
      },
    })

    const controls = app.surfaces.find(item => item.name === 'runtime-root:controls')
    const overlay = app.surfaces.find(item => item.name === 'runtime-root:overlay')
    expect(controls?.children.some(child => (child as { componentId?: string }).componentId === 'test-plugin:controls')).toBe(true)
    expect(overlay?.children.some(child => (child as { componentId?: string }).componentId === 'test-plugin:overlay')).toBe(true)

    runtime.unuse('test-plugin')

    expect(controls?.children.some(child => (child as { componentId?: string }).componentId === 'test-plugin:controls')).toBe(false)
    expect(overlay?.children.some(child => (child as { componentId?: string }).componentId === 'test-plugin:overlay')).toBe(false)
    app.destroy()
  })

  it('normalizes root props and controls marquee controller state', () => {
    const props = Root.normalizeProps({ model: createModelerModel(), width: 100, height: 80 })
    expect(props.width).toBe(100)
    expect(props.features.marqueeSelection).toBe(true)
    const controller = MarqueeSelectionPlugin.createController({ enabled: false })
    const invalidate = vi.fn()
    const dispose = controller.__bind({ invalidate, onSelectionComplete: vi.fn() })
    controller.toggle()
    expect(controller.enabled).toBe(true)
    expect(invalidate).toHaveBeenCalled()
    dispose()
    const miniMap = MiniMapPlugin.createController({ visible: false })
    const miniMapInvalidate = vi.fn()
    const disposeMiniMap = miniMap.__bind({ invalidate: miniMapInvalidate })
    miniMap.toggle()
    expect(miniMap.visible).toBe(true)
    expect(miniMapInvalidate).toHaveBeenCalled()
    disposeMiniMap()
  })
})

class TestMultiLayerPlugin extends PluginBase {
  readonly id = 'test-plugin'

  protected onSetup(): void {
    this.addDisposer(this.context.store.provide('test-plugin:state', { ready: true }))
    this.mountMany([
      {
        layer: 'controls',
        schema: { type: Modeler.Background, id: 'test-plugin:controls' },
      },
      {
        layer: 'overlay',
        schema: { type: Modeler.Background, id: 'test-plugin:overlay' },
      },
    ])
  }
}

function createControllerHost(width: number, height: number) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
  const app = Nova.createApp({
    target: document.createElement('canvas'),
    size: { width, height, dpr: 1 },
    renderer: { main: RendererType.Web2D },
    scheduler: { type: RaphSchedulerType.Sync, loop: false },
  })
  return {
    id: 'test-host',
    app,
    width,
    height,
    invalidate: vi.fn(),
    onModelCommit: vi.fn(),
    layers: {
      get: vi.fn(),
      mount: vi.fn(),
      unmount: vi.fn(),
      reconcile: vi.fn(() => vi.fn()),
    },
  }
}

function create2DContextStub(): CanvasRenderingContext2D {
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
    measureText: vi.fn(() => ({ width: 10 })),
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
