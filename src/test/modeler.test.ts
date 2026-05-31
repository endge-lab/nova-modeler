import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Nova, RaphSchedulerType, RendererType, boundsContainsPoint, type NovaSchema } from '@endge/nova'
import { NovaUIKit, type ColorPickerApi, type InputApi } from '@endge/nova-ui-kit'
import {
  Modeler,
  GridSnapStrategy,
  MarqueeSelectionPlugin,
  MiniMapPlugin,
  Root,
  SelectionRuntime,
  SnapRuntime,
  applyModelerCommand,
  appendGridSchema,
  createBpmnEventElement,
  createBpmnFlowElement,
  createBpmnGatewayElement,
  createBpmnTaskElement,
  createBasicRectElement,
  createGridRenderPlan,
  createModelerController,
  createModelerSettingsController,
  createModelerModel,
  createPluginRuntime,
  MODELER_LAYER_NAMES,
  MODELER_ASSETS,
  MODELER_SURFACE_CONFIG,
  PluginBase,
  normalizeModelerModel,
  normalizeModelerOptions,
  registerModeler,
  type ModelerSettingsDialogApi,
} from '@/index'

describe('nova modeler minimal kernel', () => {
  beforeEach(() => {
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:nova-modeler-test')
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn()
  })

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
      elements: [],
      version: 0,
      viewportVersion: 0,
      elementsVersion: 0,
      selectionVersion: 0,
    })
    const withRect = applyModelerCommand(selected, {
      type: 'element.add',
      element: createBasicRectElement({ id: 'rect-1', x: 100, y: 120 }),
    })
    expect(withRect.elements).toHaveLength(1)
    expect(withRect.elementsVersion).toBe(1)
    const resized = applyModelerCommand(withRect, {
      type: 'element.resize',
      id: 'rect-1',
      bounds: { width: 10, height: 8 },
    })
    expect(resized.elements[0]).toMatchObject({ width: 24, height: 24 })
    const deleted = applyModelerCommand({ ...resized, selection: ['rect-1'] }, {
      type: 'element.delete',
      id: 'rect-1',
    })
    expect(deleted.elements).toEqual([])
    expect(deleted.selection).toEqual([])
    const deletedMany = applyModelerCommand({
      ...resized,
      elements: [
        createBasicRectElement({ id: 'rect-1' }),
        createBasicRectElement({ id: 'rect-2' }),
      ],
      selection: ['rect-1', 'rect-2'],
    }, {
      type: 'element.deleteMany',
      ids: ['rect-1', 'rect-2'],
    })
    expect(deletedMany.elements).toEqual([])
    expect(deletedMany.selection).toEqual([])
    const rotated = applyModelerCommand(resized, {
      type: 'element.rotate',
      id: 'rect-1',
      rotation: Math.PI / 4,
    })
    expect(rotated.elements[0]?.rotation).toBe(Math.PI / 4)
  })

  it('resolves selection modifiers and delete shortcuts from options', () => {
    const options = normalizeModelerOptions().current.interaction?.selection
    expect(SelectionRuntime.resolvePointerSelection({
      current: ['a'],
      elementId: 'b',
      event: new MouseEvent('mousedown', { shiftKey: true }),
      options,
    })).toEqual(['a', 'b'])
    expect(SelectionRuntime.resolvePointerSelection({
      current: ['a', 'b'],
      elementId: 'b',
      event: new MouseEvent('mousedown', { metaKey: true }),
      options,
    })).toEqual(['a'])
    expect(SelectionRuntime.matchShortcut(
      new KeyboardEvent('keydown', { key: 'Backspace' }),
      options?.deleteShortcuts,
    )).toMatchObject({ key: 'Backspace' })
    expect(normalizeModelerOptions().current.palette).toMatchObject({
      placement: 'left',
      draggable: true,
      offset: 16,
      offsetX: undefined,
      offsetY: undefined,
      itemSize: 40,
      gap: 8,
      padding: 8,
      gripSize: 32,
    })
    expect(normalizeModelerOptions().current.branding).toMatchObject({
      visible: true,
    })
    expect(normalizeModelerOptions({
      branding: {
        visible: false,
      },
      palette: {
        placement: 'bottom',
        draggable: false,
        offset: 24,
        offsetX: 32,
        offsetY: 48,
      },
    }).current.palette).toMatchObject({
      placement: 'bottom',
      draggable: false,
      offset: 24,
      offsetX: 32,
      offsetY: 48,
    })
    expect(normalizeModelerOptions({
      branding: {
        visible: false,
      },
    }).current.branding).toMatchObject({
      visible: false,
    })
  })

  it('publishes actions, tools, palette items and shortcuts from plugins and element definitions', () => {
    const controller = createModelerController({
      model: createModelerModel(),
      plugins: [MarqueeSelectionPlugin.create()],
      options: {
        palette: {
          visibleItemIds: ['marqueeSelection.tool', 'basic.rect.create'],
          order: ['basic.rect.create', 'marqueeSelection.tool'],
        },
        shortcuts: {
          bindings: {
            'basic.rect.create': [{ key: 'b', preventDefault: true }],
          },
        },
      },
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()

    expect(context.actions.get('selection.delete')).toBeTruthy()
    expect(context.actions.get('element.create.basic.rect')).toBeTruthy()
    expect(context.actions.get('element.connect')).toBeTruthy()
    expect(context.tools.get('marqueeSelection')).toMatchObject({ kind: 'mode' })
    expect(context.tools.get('create:basic.rect')).toMatchObject({ kind: 'create-element' })
    expect(context.tools.get('connect')).toMatchObject({ kind: 'mode' })
    expect(context.palette.get('element.connect.tool')).toMatchObject({
      id: 'element.connect.tool',
      kind: 'tool',
      group: 'tools',
      order: 20,
      icon: 'connect-arrow',
      toolId: 'connect',
    })
    expect(context.palette.getItems().map(item => item.id)).toEqual(['basic.rect.create', 'marqueeSelection.tool'])
    expect(context.shortcuts.resolve(new KeyboardEvent('keydown', { key: 'r' }))).toBeUndefined()
    expect(context.shortcuts.resolve(new KeyboardEvent('keydown', { key: 'b' }))?.definition.toolId).toBe('create:basic.rect')
    expect(context.shortcuts.resolve(new KeyboardEvent('keydown', { key: 'c' }))?.definition.actionId).toBe('element.connect')
    controller.unmount()
  })

  it('publishes BPMN event variants and applies them without replacing the element', () => {
    const event = createBpmnEventElement({
      id: 'event-1',
      x: 120,
      y: 140,
      eventPosition: 'start',
      trigger: 'none',
    })
    const controller = createModelerController({
      model: createModelerModel({
        elements: [event],
        selection: [event.id],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()
    const provider = context.elementVariants.getProvider(event)
    expect(provider?.id).toBe('bpmn.event.variants')
    expect(context.palette.get('bpmn.event.create')).toMatchObject({ icon: 'bpmn-event-start' })
    expect(context.palette.get('bpmn.event.intermediate.create')).toMatchObject({ icon: 'bpmn-event-intermediate' })
    expect(context.palette.get('bpmn.event.end.create')).toMatchObject({ icon: 'bpmn-event-end' })

    const draft = provider?.createDraft?.(context, event) ?? {}
    const descriptor = provider?.getDescriptor(context, event, draft)
    const positionControl = descriptor?.controls.find(control => control.id === 'eventPosition')
    const triggerControl = descriptor?.controls.find(control => control.id === 'trigger')
    expect(positionControl?.options.map(option => option.id)).toEqual(['start', 'intermediate', 'end'])
    expect(triggerControl?.options.some(option => option.id === 'start:timer:catch')).toBe(true)
    const timer = triggerControl?.options.find(option => option.id === 'start:timer:catch')
    expect(timer).toBeTruthy()

    provider?.apply({
      context,
      element: event,
      draft,
      control: triggerControl!,
      option: timer!,
    })
    const next = controller.getModel()
    expect(next.elements[0]).toMatchObject({
      id: 'event-1',
      x: 120,
      y: 140,
      data: {
        eventPosition: 'start',
        trigger: 'timer',
        direction: 'catch',
      },
    })
    expect(next.selection).toEqual(['event-1'])
    controller.unmount()
  })

  it('normalizes BPMN task data, variants, ports and fixed bounds', () => {
    const task = createBpmnTaskElement({
      id: 'task-1',
      x: 160,
      y: 120,
      width: 180,
      height: 120,
      taskType: 'broken' as never,
      loopType: 'broken' as never,
      instantiate: true,
    })
    expect(task).toMatchObject({
      type: 'bpmn.task',
      width: 120,
      height: 80,
      data: {
        name: 'Task',
        taskType: 'none',
        loopType: 'none',
        isForCompensation: false,
        instantiate: undefined,
      },
    })

    const controller = createModelerController({
      model: createModelerModel({
        elements: [task],
        selection: [task.id],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()
    const provider = context.elementVariants.getProvider(task)
    expect(provider?.id).toBe('bpmn.task.variants')
    expect(context.palette.get('bpmn.task.create')).toMatchObject({ icon: 'bpmn-task' })

    const ports = controller.getElementRegistry().require('bpmn.task').getPorts?.(context, task) ?? []
    expect(ports.map(port => port.id)).toEqual(['top', 'right', 'bottom', 'left'])

    const draft = provider?.createDraft?.(context, task) ?? {}
    const descriptor = provider?.getDescriptor(context, task, draft)
    const typeControl = descriptor?.controls.find(control => control.id === 'taskType')
    const loopControl = descriptor?.headerControls?.find(control => control.id === 'loopType')
    expect(descriptor?.controls.some(control => control.id === 'name')).toBe(false)
    expect(descriptor?.controls.some(control => control.kind === 'toggle')).toBe(false)
    expect(loopControl?.kind).toBe('iconToggle')
    expect(typeControl?.options.map(option => option.id)).toEqual([
      'none',
      'user',
      'manual',
      'service',
      'script',
      'businessRule',
      'send',
      'receive',
    ])
    expect(loopControl?.options.map(option => option.id)).toEqual([
      'multiInstanceParallel',
      'multiInstanceSequential',
      'standard',
    ])

    provider?.apply({
      context,
      element: controller.getModel().elements[0]!,
      draft,
      control: typeControl!,
      option: typeControl!.options.find(option => option.id === 'receive')!,
    })
    const receive = controller.getModel().elements[0]!
    expect(receive).toMatchObject({
      id: 'task-1',
      x: 160,
      y: 120,
      data: {
        name: 'Task',
        taskType: 'receive',
        loopType: 'none',
        isForCompensation: false,
      },
    })
    const receiveDescriptor = provider?.getDescriptor(context, receive, provider.createDraft?.(context, receive) ?? {})
    const receiveLoopControl = receiveDescriptor?.headerControls?.find(control => control.id === 'loopType')
    expect(receiveDescriptor?.controls.some(control => control.id === 'instantiate')).toBe(false)
    provider?.apply({
      context,
      element: receive,
      draft: provider.createDraft?.(context, receive) ?? {},
      control: receiveLoopControl!,
      option: receiveLoopControl!.options.find(option => option.id === 'multiInstanceParallel')!,
    })
    expect(controller.getModel().elements[0]).toMatchObject({
      width: 120,
      height: 80,
      data: {
        loopType: 'multiInstanceParallel',
        isForCompensation: false,
        instantiate: false,
      },
    })
    controller.applyCommand({
      type: 'element.resize',
      id: 'task-1',
      bounds: { x: 100, y: 100, width: 240, height: 160 },
    })
    expect(controller.getModel().elements[0]).toMatchObject({ x: 160, y: 120, width: 120, height: 80 })
    expect(controller.hitTest(controller.worldToScreen({ x: 180, y: 140 }))).toEqual({ type: 'element', id: 'task-1' })
    expect(controller.getModel().selection).toEqual(['task-1'])
    controller.unmount()
  })

  it('normalizes BPMN gateway data, variants, ports and diamond hit area', () => {
    expect(createBpmnGatewayElement({ id: 'gateway-default' })).toMatchObject({
      type: 'bpmn.gateway',
      width: 56,
      height: 56,
      data: {
        gatewayType: 'exclusive',
      },
    })
    const gateway = createBpmnGatewayElement({
      id: 'gateway-1',
      x: 160,
      y: 120,
      width: 96,
      height: 96,
      gatewayType: 'broken' as never,
    })
    expect(gateway).toMatchObject({
      type: 'bpmn.gateway',
      width: 96,
      height: 96,
      data: {
        gatewayType: 'exclusive',
      },
    })

    const controller = createModelerController()
    controller.mount(createControllerHost(640, 420))
    controller.applyCommand({ type: 'element.add', element: gateway })
    controller.applyCommand({ type: 'select', ids: [gateway.id] })
    expect(controller.getModel()).toMatchObject({
      version: 2,
      elementsVersion: 1,
      selectionVersion: 1,
    })

    const context = controller.getPluginContext()
    const current = controller.getModel().elements[0]!
    const provider = context.elementVariants.getProvider(current)
    expect(provider?.id).toBe('bpmn.gateway.variants')
    expect(context.palette.get('bpmn.gateway.create')).toMatchObject({ icon: 'bpmn-gateway' })
    expect(context.shortcuts.resolve(new KeyboardEvent('keydown', { key: 'g' }))?.definition.toolId).toBe('create:bpmn.gateway')

    const ports = controller.getElementRegistry().require('bpmn.gateway').getPorts?.(context, current) ?? []
    expect(ports.map(port => port.id)).toEqual(['top', 'right', 'bottom', 'left'])

    const draft = provider?.createDraft?.(context, current) ?? {}
    const descriptor = provider?.getDescriptor(context, current, draft)
    const typeControl = descriptor?.controls.find(control => control.id === 'gatewayType')
    expect(typeControl?.options.map(option => option.id)).toEqual([
      'exclusive',
      'parallel',
      'inclusive',
      'complex',
      'eventBased',
      'parallelEventBased',
    ])
    expect(typeControl?.options.every(option => Boolean(option.icon))).toBe(true)

    for (const option of typeControl?.options ?? []) {
      provider?.apply({
        context,
        element: controller.getModel().elements[0]!,
        draft: provider.createDraft?.(context, controller.getModel().elements[0]!) ?? {},
        control: typeControl!,
        option,
      })
      expect(controller.getModel().elements[0]?.data?.gatewayType).toBe(option.id)
    }

    expect(controller.hitTest(controller.worldToScreen({ x: 208, y: 168 }))).toEqual({ type: 'element', id: 'gateway-1' })
    expect(controller.hitTest(controller.worldToScreen({ x: 162, y: 122 }))).toEqual({ type: 'canvas' })
    expect(controller.getModel().selection).toEqual(['gateway-1'])
    controller.unmount()
  })

  it('normalizes BPMN flows, resolves endpoints and removes connected flows with nodes', () => {
    const start = createBpmnEventElement({ id: 'start-1', x: 100, y: 100 })
    const task = createBpmnTaskElement({ id: 'task-1', x: 220, y: 84 })
    const flow = createBpmnFlowElement({
      id: 'flow-1',
      flowType: 'broken' as never,
      source: { elementId: start.id, portId: 'right', point: { x: 148, y: 124 } },
      target: { elementId: task.id, portId: 'left', point: { x: 220, y: 124 } },
      waypoints: [{ x: 184, y: 124 }],
    })
    expect(flow).toMatchObject({
      type: 'bpmn.flow',
      data: { flowType: 'sequence' },
      waypoints: [{ x: 184, y: 124 }],
    })

    const controller = createModelerController({
      model: createModelerModel({
        elements: [start, task, flow],
        selection: [flow.id],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()
    const current = controller.getModel().elements.find(element => element.id === flow.id)!
    const provider = context.elementVariants.getProvider(current)
    expect(provider?.id).toBe('bpmn.flow.variants')
    const descriptor = provider?.getDescriptor(context, current, provider.createDraft?.(context, current) ?? {})
    const typeControl = descriptor?.controls.find(control => control.id === 'flowType')
    expect(typeControl?.options.map(option => option.id)).toEqual(['sequence', 'conditionalSequence', 'defaultSequence'])

    for (const option of typeControl?.options ?? []) {
      provider?.apply({
        context,
        element: controller.getModel().elements.find(element => element.id === flow.id)!,
        draft: provider.createDraft?.(context, current) ?? {},
        control: typeControl!,
        option,
      })
      expect(controller.getModel().elements.find(element => element.id === flow.id)?.data?.flowType).toBe(option.id)
    }

    expect(controller.hitTest(controller.worldToScreen({ x: 184, y: 124 }))).toEqual({
      type: 'edge-waypoint-handle',
      elementId: flow.id,
      waypointIndex: 0,
    })
    controller.applyCommand({ type: 'select', ids: [] })
    expect(controller.hitTest(controller.worldToScreen({ x: 184, y: 124 }))).toEqual({ type: 'element', id: flow.id })
    expect(controller.hitTest(controller.worldToScreen({ x: 184, y: 160 }))).toEqual({ type: 'canvas' })
    controller.applyCommand({ type: 'element.patch', id: task.id, patch: { x: 260 } })
    const path = context.getElementRegistry().require('bpmn.flow').hitTest?.(context, controller.getModel().elements.find(element => element.id === flow.id)!, { x: 260, y: 124 })
    expect(path).toBe(true)

    controller.applyCommand({ type: 'element.delete', id: start.id })
    expect(controller.getModel().elements.some(element => element.id === flow.id)).toBe(false)
    expect(controller.getModel().selection).toEqual([])
    controller.unmount()
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

  it('hit-tests basic rect body, resize handles and ports', () => {
    const model = createModelerModel({
      elements: [createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 })],
      selection: ['rect-1'],
    })
    const controller = createModelerController({ model })
    controller.mount(createControllerHost(640, 420))

    expect(controller.hitTest({ x: 140, y: 130 })).toEqual({ type: 'element', id: 'rect-1' })
    expect(controller.hitTest({ x: 180, y: 72 })).toEqual({ type: 'rotate-handle', elementId: 'rect-1' })
    expect(controller.hitTest({ x: 100, y: 100 })).toEqual({ type: 'resize-handle', elementId: 'rect-1', handle: 'nw' })
    expect(controller.hitTest({ x: 180, y: 95 })).toEqual({ type: 'port', elementId: 'rect-1', portId: 'top' })
    expect(controller.hitTest({ x: 265, y: 148 })).toEqual({ type: 'port', elementId: 'rect-1', portId: 'right' })
  })

  it('normalizes and hit-tests BPMN none events as circles', () => {
    const event = createBpmnEventElement({
      id: 'start-1',
      x: 100,
      y: 100,
      eventPosition: 'start',
      trigger: 'none',
    })
    expect(event).toMatchObject({
      type: 'bpmn.event',
      width: 48,
      height: 48,
      data: {
        eventPosition: 'start',
        trigger: 'none',
      },
    })

    const controller = createModelerController({
      model: createModelerModel({
        elements: [event],
        selection: ['start-1'],
      }),
    })
    controller.mount(createControllerHost(640, 420))

    expect(controller.getElementRegistry().require('bpmn.event').normalize?.(event).data.trigger).toBe('none')
    expect(controller.hitTest({ x: 124, y: 124 })).toEqual({ type: 'element', id: 'start-1' })
    expect(controller.hitTest({ x: 100, y: 100 })).toEqual({ type: 'canvas' })
    expect(controller.hitTest({ x: 124, y: 95 })).toEqual({ type: 'port', elementId: 'start-1', portId: 'top' })
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

  it('snaps move and resize to world grid independently from zoom', () => {
    const element = createBasicRectElement({ id: 'rect-1', x: 100, y: 120, width: 160, height: 96 })
    const strategy = new GridSnapStrategy()

    expect(strategy.snapPoint({
      point: { x: 117, y: 143 },
      gridSize: 32,
      element,
    })).toEqual({ x: 128, y: 128 })

    expect(strategy.snapResize({
      element,
      source: element,
      handle: 'e',
      gridSize: 32,
      minSize: { minWidth: 24, minHeight: 24 },
      bounds: { x: 100, y: 120, width: 177, height: 96 },
    })).toMatchObject({ x: 100, y: 120, width: 188, height: 96 })

    expect(strategy.snapResize({
      element,
      source: element,
      handle: 'w',
      gridSize: 32,
      minSize: { minWidth: 24, minHeight: 24 },
      bounds: { x: 77, y: 120, width: 183, height: 96 },
    })).toMatchObject({ x: 64, y: 120, width: 196, height: 96 })
  })

  it('uses interaction snap options and modifier override through SnapRuntime', () => {
    const element = createBasicRectElement({ id: 'rect-1', x: 100, y: 120 })
    const context = {
      getOptions: () => normalizeModelerOptions({
        interaction: {
          gridSize: 32,
          snap: { enabled: true, disableModifier: 'alt' },
        },
      }).current,
      getModel: () => createModelerModel({ canvas: { gridSize: 16 } }),
    }
    const runtime = new SnapRuntime(context as never)

    expect(runtime.moveElement({
      element,
      raw: { x: 119, y: 141 },
    })).toEqual({ x: 128, y: 128 })

    expect(runtime.moveElement({
      element,
      raw: { x: 119, y: 141 },
      event: new MouseEvent('mousemove', { altKey: true }),
    })).toEqual({ x: 119, y: 141 })
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
    expect(tiny.spacing).toBe(51.2)
    expect(tiny.dotCount).toBeLessThanOrEqual(32_000)
    expect(tiny.radius).toBeLessThan(normal.radius)
    expect(tiny.offsetX).toBeGreaterThanOrEqual(0)
    expect(tiny.offsetY).toBeGreaterThanOrEqual(0)

    const lowZoom = createGridRenderPlan({
      width: 2048,
      height: 1152,
      gridSize: 32,
      scale: 0.25,
      viewportX: 0,
      viewportY: 0,
    })
    expect(lowZoom.spacing).toBe(32)
    expect(lowZoom.dotCount).toBeLessThan(3_000)

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
      size: { width: 640, height: 760, dpr: 1 },
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
        height: 760,
        plugins: [MiniMapPlugin.create(), MarqueeSelectionPlugin.create()],
      },
    }) as Root
    app.schema.createChild(root, { type: Modeler.ZoomControls, props: { step: 0.2 } })
    app.raph.run()
    expect(root.getApi().getViewport().scale).toBe(1)
    expect(root.getApi().setViewport({ scale: 1.4 }).viewport.scale).toBe(1.4)
    expect(root.getApi().fitView().scale).toBeGreaterThan(0)
  })

  it('registers and renders basic rect and BPMN graph elements', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 760, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'elements-root',
      props: {
        model: createModelerModel({
          elements: [
            createBasicRectElement({ id: 'rect-1', x: 100, y: 100 }),
            createBpmnEventElement({ id: 'start-1', x: 320, y: 120 }),
            createBpmnGatewayElement({ id: 'gateway-1', x: 420, y: 120, gatewayType: 'parallel' }),
            createBpmnFlowElement({
              id: 'flow-1',
              flowType: 'conditionalSequence',
              source: { elementId: 'start-1', portId: 'right', point: { x: 368, y: 144 } },
              target: { elementId: 'gateway-1', portId: 'left', point: { x: 420, y: 148 } },
              waypoints: [{ x: 394, y: 146 }],
            }),
          ],
          selection: ['rect-1', 'start-1', 'gateway-1', 'flow-1'],
        }),
        width: 640,
        height: 760,
      },
    })
    app.raph.run()
    const interaction = app.surfaces.find(item => item.name === 'elements-root:interaction')
    const links = app.surfaces.find(item => item.name === 'elements-root:links')
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'rect-1:view')).toBe(true)
    expect(links?.children.some(child => (child as { componentId?: string }).componentId === 'flow-1:view')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'flow-1:view')).toBe(false)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'start-1:view')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'gateway-1:view')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'rect-1:rotate')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'rect-1:resize:nw')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'rect-1:port:top')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'start-1:port:top')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'gateway-1:port:top')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'flow-1:waypoint:0')).toBe(true)
    const schemaItems = [
      ...(links?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []),
      ...(interaction?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []),
    ]
    expect(schemaItems.some(item => item.type === 'polygon')).toBe(true)
    app.destroy()
  })

  it('registers and renders BPMN task icons, markers, ports and fixed hit areas', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 760, height: 520, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'task-render-root',
      props: {
        model: createModelerModel({
          elements: [
            createBpmnTaskElement({ id: 'task-none', x: 80, y: 80, name: 'Plain task' }),
            createBpmnTaskElement({ id: 'task-user', x: 240, y: 80, name: 'User approval', taskType: 'user' }),
            createBpmnTaskElement({ id: 'task-service', x: 400, y: 80, name: 'Service call', taskType: 'service', loopType: 'multiInstanceParallel' }),
            createBpmnTaskElement({ id: 'task-receive', x: 560, y: 80, name: 'Receive start', taskType: 'receive', instantiate: true, isForCompensation: true }),
            createBpmnTaskElement({ id: 'task-fixed', x: 220, y: 240, width: 180, height: 120, name: 'Fixed task', loopType: 'multiInstanceSequential' }),
          ],
          selection: ['task-fixed'],
        }),
        width: 760,
        height: 520,
      },
    }) as Root
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'task-render-root:interaction')
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-user:view')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-fixed:port:top')).toBe(true)
    expect(interaction?.children.some(child => String((child as { componentId?: string }).componentId).includes(':resize:'))).toBe(false)
    expect(root.getApi().getModel().elements.find(element => element.id === 'task-fixed')).toMatchObject({ width: 120, height: 80 })
    expect(root.hitTest({ x: 260, y: 280 })).toEqual({ type: 'element', id: 'task-fixed' })
    expect(root.hitTest({ x: 220, y: 240 })).toEqual({ type: 'element', id: 'task-fixed' })
    expect(root.resolveNovaTooltipTarget({ x: 260, y: 100 })).toBeNull()
    expect(root.resolveNovaTooltipTarget({ x: 620, y: 100 })).toBeNull()

    const schemaItems = interaction?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    const userTaskItems = schemaItems.filter(item => item.type === 'icon' || item.text === 'User approval')
    const serviceTaskItems = schemaItems.filter(item => item.type === 'icon' || item.type === 'line')
    const receiveTaskItems = schemaItems.filter(item => item.type === 'circle' || item.type === 'polygon' || item.text === 'Receive start')

    expect(schemaItems.some(item => item.type === 'text' && item.text === 'Plain task')).toBe(true)
    expect(userTaskItems.some(item => item.type === 'icon')).toBe(true)
    expect(serviceTaskItems.some(item => item.type === 'line')).toBe(true)
    expect(receiveTaskItems.some(item => item.type === 'circle')).toBe(true)
    expect(receiveTaskItems.some(item => item.type === 'polygon')).toBe(true)
    app.destroy()
  })

  it('edits BPMN task name inline from a double click on the text area', () => {
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
      id: 'task-name-edit-root',
      props: {
        model: createModelerModel({
          elements: [createBpmnTaskElement({ id: 'task-1', x: 220, y: 100, name: 'Review task' })],
          selection: ['task-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()
    const openEditor = (): void => {
      ;(root as unknown as { openTaskNameEditorFromPoint(point: { x: number; y: number }): boolean })
        .openTaskNameEditorFromPoint({ x: 280, y: 140 })
      app.raph.run()
    }

    app.handleEvent('mousedown', offsetMouseEvent('mousedown', 280, 140))
    app.handleEvent('mouseup', offsetMouseEvent('mouseup', 280, 140))
    app.handleEvent('mousedown', offsetMouseEvent('mousedown', 280, 140))
    app.handleEvent('mouseup', offsetMouseEvent('mouseup', 280, 140))
    app.raph.run()
    const inputId = 'task-name-edit-root:task-name-editor:input'
    const input = app.components.requireApi<InputApi>(inputId)
    const interaction = app.surfaces.find(item => item.name === 'task-name-edit-root:interaction')
    const getInteractionTexts = (): Array<unknown> => interaction
      ?.compileRenderFrame().items
      .map(item => item.schemaItem)
      .filter(item => item?.type === 'text')
      .map(item => item?.text) ?? []
    expect(getInteractionTexts()).not.toContain('Review task')
    expect(input.getProps()).toMatchObject({
      variant: 'ghost',
      align: 'center',
      color: 'var(--modeler-bpmn-task-text-color, #111827)',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 12.8,
      fontWeight: '500',
      lineHeight: 16,
      background: 'rgba(255,255,255,0)',
      border: { width: 0 },
      hoverBackground: 'rgba(255,255,255,0)',
      pressedBackground: 'rgba(255,255,255,0)',
      activeBackground: 'rgba(255,255,255,0)',
      focusBorderColor: 'rgba(255,255,255,0)',
      selectOnFocus: false,
    })

    input.setValue('Approve invoice')
    input.commit()
    app.raph.run()
    expect(root.getApi().getModel().elements[0]?.data?.name).toBe('Approve invoice')
    expect(getInteractionTexts()).toContain('Approve invoice')
    expect(app.components.get(inputId)).toBeFalsy()

    openEditor()
    app.components.requireApi<InputApi>(inputId).setValue('Cancelled name')
    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'Escape' }))
    app.raph.run()
    expect(root.getApi().getModel().elements[0]?.data?.name).toBe('Approve invoice')
    expect(app.components.get(inputId)).toBeFalsy()

    openEditor()
    app.components.requireApi<InputApi>(inputId).setValue('Committed outside')
    app.handleEvent('mousedown', offsetMouseEvent('mousedown', 560, 320))
    app.handleEvent('mouseup', offsetMouseEvent('mouseup', 560, 320))
    app.raph.run()
    expect(root.getApi().getModel().elements[0]?.data?.name).toBe('Committed outside')
    expect(app.components.get(inputId)).toBeFalsy()
    app.destroy()
  })

  it('resolves palette item tooltips from virtual palette targets', () => {
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
      id: 'palette-tooltip-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
        options: {
          branding: {
            visible: false,
          },
        },
      },
    })
    app.raph.run()
    app.raph.run()

    const palette = app.components.require('palette-tooltip-root:palette') as unknown as {
      resolveNovaTooltipTarget(input: { x: number; y: number }): { tooltip?: unknown; rect?: { x: number; y: number; width: number; height: number } } | null
    }
    const connectTooltip = palette.resolveNovaTooltipTarget({ x: 44, y: 44 })
    const rectTooltip = palette.resolveNovaTooltipTarget({ x: 44, y: 101 })
    const rectTooltipFromEdge = palette.resolveNovaTooltipTarget({ x: 60, y: 117 })
    const eventTooltip = palette.resolveNovaTooltipTarget({ x: 44, y: 149 })
    expect(connectTooltip?.tooltip).toMatchObject({ value: 'Connect elements', placement: 'cursor' })
    expect(connectTooltip?.rect).toMatchObject({ x: 24, y: 24, width: 40, height: 40 })
    expect(rectTooltip?.tooltip).toMatchObject({ value: 'Create Rectangle', placement: 'cursor' })
    expect(rectTooltip?.rect).toMatchObject({ x: 24, y: 81, width: 40, height: 40 })
    expect(rectTooltipFromEdge?.rect).toMatchObject({ x: 24, y: 81, width: 40, height: 40 })
    expect(eventTooltip?.tooltip).toMatchObject({ value: 'Create Start event', placement: 'cursor' })
    expect(eventTooltip?.rect).toMatchObject({ x: 24, y: 129, width: 40, height: 40 })
    app.destroy()
  })

  it('updates modeler cursors for object gestures and clears selection on empty click', () => {
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
      id: 'cursor-root',
      props: {
        model: createModelerModel({
          elements: [createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 })],
          selection: ['rect-1'],
        }),
        width: 640,
        height: 420,
      },
    })
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 140, clientY: 130, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('grabbing')
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 140, clientY: 130, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('move')

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 100, clientY: 100, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('nwse-resize')
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 100, clientY: 100, button: 0 }))

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 180, clientY: 72, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('grabbing')
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 180, clientY: 72, button: 0 }))

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 88, clientY: 24, button: 0 }))
    expect(root.getApi().getModel().selection).toEqual([])
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 88, clientY: 24, button: 0 }))

    app.destroy()
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
    expect(MODELER_LAYER_NAMES).toEqual(['background', 'links', 'interaction', 'controls', 'overlay'])
    expect(MODELER_SURFACE_CONFIG.links.zIndex).toBeLessThan(MODELER_SURFACE_CONFIG.interaction.zIndex)

    const links = app.surfaces.find(item => item.name === 'modeler-root:links')
    const controls = app.surfaces.find(item => item.name === 'modeler-root:controls')
    const overlay = app.surfaces.find(item => item.name === 'modeler-root:overlay')
    expect(links?.interactive).toBe(false)
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

  it('keeps default controls when only other named layer slots are provided', () => {
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
      id: 'partial-slots-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
      slots: {
        background: () => [
          { type: Modeler.Background, id: 'partial-background' },
          { type: Modeler.Grid, id: 'partial-grid' },
        ],
        overlay: () => [],
      },
    })
    app.raph.run()
    app.raph.run()

    const controls = app.surfaces.find(item => item.name === 'partial-slots-root:controls')
    expect(controls?.children.map(child => (child as { componentId?: string }).componentId)).toContain('partial-slots-root:default-controls')
    expect(controls?.children.map(child => (child as { componentId?: string }).componentId)).toContain('partial-slots-root:brand-logo')
    expect(controls?.children.map(child => (child as { componentId?: string }).componentId)).toContain('partial-slots-root:palette')
    expect(controls?.children.map(child => (child as { componentId?: string }).componentId)).toContain('partial-slots-root:context-pad')
    const brandItems = controls?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(brandItems.find(item => item.type === 'text' && item.text === 'Nova')).toMatchObject({
      y: 3,
      height: 22,
      styles: {
        font: {
          family: 'ui-rounded, "SF Pro Rounded", ui-sans-serif, system-ui, sans-serif',
          size: 22,
          weight: '900',
        },
        lineHeight: 22,
      },
    })
    expect(brandItems.find(item => item.type === 'text' && item.text === 'Modeler')).toMatchObject({
      y: 29,
      height: 12,
      styles: {
        font: {
          family: 'ui-rounded, "SF Pro Rounded", ui-sans-serif, system-ui, sans-serif',
          size: 10,
          weight: '700',
        },
        lineHeight: 12,
      },
    })
    expect(app.events.hitTest(44, 116)?.componentId).toBe('partial-slots-root:palette')
    expect(app.events.hitTest(606, 34)?.componentId).toContain('partial-slots-root:zoom-controls')

    app.setHitTestMode('spatial')
    expect(app.events.hitTest(606, 34)?.componentId).toContain('partial-slots-root:zoom-controls')
    app.destroy()
  })

  it('hides the default brand logo and keeps the palette at the base offset when branding is disabled', () => {
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
      id: 'no-brand-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
        options: {
          branding: {
            visible: false,
          },
        },
      },
    })
    app.raph.run()
    app.raph.run()

    const controls = app.surfaces.find(item => item.name === 'no-brand-root:controls')
    expect(controls?.children.map(child => (child as { componentId?: string }).componentId)).not.toContain('no-brand-root:brand-logo')
    expect(app.events.hitTest(44, 44)?.componentId).toBe('no-brand-root:palette')
    app.destroy()
  })

  it('deletes the selected element from the default context pad', () => {
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
      id: 'context-pad-root',
      props: {
        model: createModelerModel({
          elements: [createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 })],
          selection: ['rect-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const target = app.events.hitTest(292, 120)
    expect(target?.componentId).toBe('context-pad-root:context-pad')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 292, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 292, clientY: 120, button: 0 }))
    app.raph.run()

    expect(root.getApi().getModel().elements).toEqual([])
    expect(root.getApi().getModel().selection).toEqual([])
    app.destroy()
  })

  it('opens color menu from the default context pad and applies preset fill', () => {
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
      id: 'color-menu-root',
      props: {
        model: createModelerModel({
          elements: [createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 })],
          selection: ['rect-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(336, 120)?.componentId).toBe('color-menu-root:context-pad')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 336, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 336, clientY: 120, button: 0 }))
    app.raph.run()

    expect(app.events.hitTest(350, 216)?.componentId).toBe('color-menu-root:context-pad:color-menu:picker')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 350, clientY: 216, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 350, clientY: 216, button: 0 }))
    app.raph.run()

    expect(root.getApi().getModel().elements[0]?.style).toMatchObject({
      fill: '#bfdbfe',
      stroke: '#1d4ed8',
    })
    app.destroy()
  })

  it('opens custom color controls from the fill color menu and applies hex fill without changing stroke', () => {
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
      id: 'color-menu-custom-root',
      props: {
        model: createModelerModel({
          elements: [createBasicRectElement({
            id: 'rect-1',
            x: 100,
            y: 100,
            width: 160,
            height: 96,
            style: { fill: '#ffffff', stroke: '#1f2937' },
          })],
          selection: ['rect-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 336, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 336, clientY: 120, button: 0 }))
    app.raph.run()

    expect(app.events.hitTest(308, 338)?.componentId).not.toBe('color-menu-custom-root:context-pad:color-menu:picker')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 308, clientY: 306, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 308, clientY: 306, button: 0 }))
    app.raph.run()
    expect(app.events.hitTest(348, 392)?.componentId).toBe('color-menu-custom-root:context-pad:color-menu:picker')

    const picker = app.components.requireApi<ColorPickerApi>('color-menu-custom-root:context-pad:color-menu:picker')
    picker.getProps().onCommit?.('#112233', { source: 'input' })
    app.raph.run()

    expect(root.getApi().getModel().elements[0]?.style).toMatchObject({
      fill: '#112233',
      stroke: '#1f2937',
    })
    app.destroy()
  })

  it('applies rgba custom fill from the fill color menu', () => {
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
      id: 'color-menu-rgba-root',
      props: {
        model: createModelerModel({
          elements: [createBasicRectElement({
            id: 'rect-1',
            x: 100,
            y: 100,
            width: 160,
            height: 96,
            style: { fill: '#ffffff', stroke: '#1f2937' },
          })],
          selection: ['rect-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 336, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 336, clientY: 120, button: 0 }))
    app.raph.run()
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 308, clientY: 306, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 308, clientY: 306, button: 0 }))
    app.raph.run()

    const picker = app.components.requireApi<ColorPickerApi>('color-menu-rgba-root:context-pad:color-menu:picker')
    picker.getProps().onCommit?.('rgba(255, 255, 255, 0.4)', { source: 'input' })
    app.raph.run()

    expect(root.getApi().getModel().elements[0]?.style).toMatchObject({
      fill: 'rgba(255, 255, 255, 0.4)',
      stroke: '#1f2937',
    })
    app.destroy()
  })

  it('routes pointer events to the element variant menu from context pad', () => {
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
      id: 'variant-menu-root',
      props: {
        model: createModelerModel({
          elements: [createBpmnEventElement({ id: 'event-1', x: 220, y: 100 })],
          selection: ['event-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(292, 120)?.componentId).toBe('variant-menu-root:context-pad')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 292, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 292, clientY: 120, button: 0 }))
    app.raph.run()

    expect(app.events.hitTest(448, 112)?.componentId).toBe('variant-menu-root:context-pad:variant-menu')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 448, clientY: 112, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 448, clientY: 112, button: 0 }))
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 448, clientY: 202, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 448, clientY: 202, button: 0 }))
    app.raph.run()

    expect(root.getApi().getModel().elements[0]?.data).toMatchObject({
      eventPosition: 'intermediate',
      trigger: 'none',
    })
    app.destroy()
  })

  it('applies event type changes immediately while preserving a compatible trigger', () => {
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
      id: 'variant-menu-immediate-root',
      props: {
        model: createModelerModel({
          elements: [createBpmnEventElement({
            id: 'event-1',
            x: 220,
            y: 100,
            eventPosition: 'start',
            trigger: 'message',
            direction: 'catch',
          })],
          selection: ['event-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 292, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 292, clientY: 120, button: 0 }))
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 448, clientY: 112, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 448, clientY: 112, button: 0 }))
    app.raph.run()

    expect(root.getApi().getModel().elements[0]?.data).toMatchObject({
      eventPosition: 'intermediate',
      trigger: 'message',
      direction: 'catch',
    })
    app.destroy()
  })

  it('closes the element variant menu on outside pointer down and Escape', () => {
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
      id: 'variant-menu-close-root',
      props: {
        model: createModelerModel({
          elements: [createBpmnEventElement({ id: 'event-1', x: 220, y: 100 })],
          selection: ['event-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 292, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 292, clientY: 120, button: 0 }))
    app.raph.run()
    expect(app.events.hitTest(448, 112)?.componentId).toBe('variant-menu-close-root:context-pad:variant-menu')

    window.dispatchEvent(new MouseEvent('mousedown', { clientX: 120, clientY: 320, button: 0 }))
    app.raph.run()
    expect(app.events.hitTest(448, 112)?.componentId).not.toBe('variant-menu-close-root:context-pad:variant-menu')

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 292, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 292, clientY: 120, button: 0 }))
    app.raph.run()
    expect(app.events.hitTest(448, 112)?.componentId).toBe('variant-menu-close-root:context-pad:variant-menu')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    app.raph.run()
    expect(app.events.hitTest(448, 112)?.componentId).not.toBe('variant-menu-close-root:context-pad:variant-menu')
    app.destroy()
  })

  it('closes the fill color menu when viewport pan starts from wheel input', () => {
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
      id: 'color-menu-pan-close-root',
      props: {
        model: createModelerModel({
          elements: [createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 })],
          selection: ['rect-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 336, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 336, clientY: 120, button: 0 }))
    app.raph.run()
    expect(app.components.get('color-menu-pan-close-root:context-pad:color-menu:picker')).toBeTruthy()

    app.handleEvent('wheel', new WheelEvent('wheel', { clientX: 560, clientY: 320, deltaX: 16, deltaY: 24 }))
    app.raph.run()
    expect(app.components.get('color-menu-pan-close-root:context-pad:color-menu:picker')).toBeFalsy()
    expect(app.components.get('color-menu-pan-close-root:context-pad:color-menu')).toBeFalsy()
    app.destroy()
  })

  it('closes menus from slotted context pads when viewport pan starts', () => {
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
    const controller = createModelerController({
      model: createModelerModel({
        elements: [createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 })],
        selection: ['rect-1'],
      }),
    })
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'slotted-menu-pan-close-root',
      props: {
        model: controller.getModel(),
        controller,
        width: 640,
        height: 420,
      },
      slots: {
        controls: () => [
          {
            type: Modeler.ContextPad,
            id: 'external-context-pad',
            props: { controller },
          },
        ],
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 336, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 336, clientY: 120, button: 0 }))
    app.raph.run()
    expect(app.components.get('external-context-pad:color-menu:picker')).toBeTruthy()

    app.handleEvent('wheel', new WheelEvent('wheel', { clientX: 560, clientY: 320, deltaX: 16, deltaY: 24 }))
    app.raph.run()
    expect(app.components.get('external-context-pad:color-menu:picker')).toBeFalsy()
    expect(app.components.get('external-context-pad:color-menu')).toBeFalsy()
    app.destroy()
  })

  it('closes the element variant menu when viewport zoom starts', () => {
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
      id: 'variant-menu-zoom-close-root',
      props: {
        model: createModelerModel({
          elements: [createBpmnEventElement({ id: 'event-1', x: 220, y: 100 })],
          selection: ['event-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 292, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 292, clientY: 120, button: 0 }))
    app.raph.run()
    expect(app.components.get('variant-menu-zoom-close-root:context-pad:variant-menu')).toBeTruthy()

    app.handleEvent('wheel', new WheelEvent('wheel', { clientX: 140, clientY: 400, deltaY: -120, ctrlKey: true }))
    app.raph.run()
    expect(app.components.get('variant-menu-zoom-close-root:context-pad:variant-menu')).toBeFalsy()
    app.destroy()
  })

  it('deletes selected elements with configurable keyboard shortcuts', () => {
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
      id: 'keyboard-root',
      props: {
        model: createModelerModel({
          elements: [
            createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 }),
            createBasicRectElement({ id: 'rect-2', x: 320, y: 100, width: 160, height: 96 }),
          ],
          selection: ['rect-1', 'rect-2'],
        }),
        options: {
          interaction: {
            selection: {
              deleteShortcuts: [{ key: 'x', meta: true, preventDefault: true }],
            },
          },
        },
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(root.getApi().getModel().elements).toHaveLength(2)

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'x', metaKey: true }))
    expect(root.getApi().getModel().elements).toEqual([])
    expect(root.getApi().getModel().selection).toEqual([])
    app.destroy()
  })

  it('selects elements with marquee using the configured modifier', () => {
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
    const runtime = createPluginRuntime().use(MarqueeSelectionPlugin.create())
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'marquee-root',
      props: {
        model: createModelerModel({
          elements: [
            createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 }),
            createBasicRectElement({ id: 'rect-2', x: 400, y: 100, width: 160, height: 96 }),
          ],
        }),
        pluginRuntime: runtime,
        options: {
          viewport: {
            panMode: 'space-drag',
          },
          branding: {
            visible: false,
          },
          interaction: {
            selection: {
              marqueeModifier: 'ctrl',
            },
          },
        },
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const controller = (root as unknown as { controllerInstance: ReturnType<typeof createModelerController> }).controllerInstance
    const context = controller.getPluginContext()
    expect(controller.getGestures().some(gesture => gesture.hitTest?.(
      context,
      offsetMouseEvent('mousedown', 180, 80, { shiftKey: true }),
      controller.hitTest({ x: 180, y: 80 }),
    ))).toBe(false)
    expect(root.getApi().getModel().selection).toEqual([])

    const startEvent = offsetMouseEvent('mousedown', 80, 80, { ctrlKey: true })
    const marqueeGesture = controller.getGestures().find(gesture => gesture.hitTest?.(
      context,
      startEvent,
      controller.hitTest({ x: 80, y: 80 }),
    ))
    expect(marqueeGesture).toBeDefined()
    marqueeGesture?.onPointerDown?.(context, startEvent)
    marqueeGesture?.onPointerMove?.(context, offsetMouseEvent('mousemove', 280, 220, { ctrlKey: true }))
    marqueeGesture?.onPointerUp?.(context, offsetMouseEvent('mouseup', 280, 220, { ctrlKey: true }))
    expect(root.getApi().getModel().selection).toEqual(['rect-1'])
    app.destroy()
  })

  it('moves all selected elements when dragging a selected element', () => {
    const controller = createModelerController({
      model: createModelerModel({
        elements: [
          createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 }),
          createBasicRectElement({ id: 'rect-2', x: 320, y: 100, width: 160, height: 96 }),
        ],
        selection: ['rect-1', 'rect-2'],
      }),
      options: {
        interaction: {
          snap: false,
        },
      },
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()
    const moveGesture = controller.getGestures().find(gesture => gesture.id === 'modeler-elements:move')

    expect(moveGesture?.hitTest?.(context, offsetMouseEvent('mousedown', 140, 130), controller.hitTest({ x: 140, y: 130 }))).toBe(true)
    moveGesture?.onPointerDown?.(context, offsetMouseEvent('mousedown', 140, 130))
    moveGesture?.onPointerMove?.(context, offsetMouseEvent('mousemove', 180, 160))
    moveGesture?.onPointerUp?.(context, offsetMouseEvent('mouseup', 180, 160))

    expect(controller.getModel().selection).toEqual(['rect-1', 'rect-2'])
    expect(controller.getModel().elements).toMatchObject([
      { id: 'rect-1', x: 140, y: 130 },
      { id: 'rect-2', x: 360, y: 130 },
    ])
    controller.unmount()
  })

  it('renders drag shadow and restores moved elements when move is cancelled', () => {
    const controller = createModelerController({
      model: createModelerModel({
        elements: [
          createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 }),
        ],
        selection: ['rect-1'],
      }),
      options: {
        interaction: {
          snap: false,
        },
      },
    })
    const host = createControllerHost(640, 420)
    controller.mount(host)
    const context = controller.getPluginContext()
    const moveGesture = controller.getGestures().find(gesture => gesture.id === 'modeler-elements:move')

    moveGesture?.onPointerDown?.(context, offsetMouseEvent('mousedown', 140, 130))
    const shadowSchemas = host.layers.reconcile.mock.calls.at(-1)?.[2] ?? []
    expect(shadowSchemas.some((schema: { id?: string }) => schema.id === 'rect-1:view:shadow')).toBe(true)

    moveGesture?.onPointerMove?.(context, offsetMouseEvent('mousemove', 180, 160))
    expect(controller.getModel().elements[0]).toMatchObject({ id: 'rect-1', x: 140, y: 130 })

    moveGesture?.onCancel?.(context)
    expect(controller.getModel().elements[0]).toMatchObject({ id: 'rect-1', x: 100, y: 100 })
    const finalSchemas = host.layers.reconcile.mock.calls.at(-1)?.[2] ?? []
    expect(finalSchemas.some((schema: { id?: string }) => schema.id === 'rect-1:view:shadow')).toBe(false)
    controller.unmount()
  })

  it('activates marquee selection from the palette tool item', () => {
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
    const runtime = createPluginRuntime().use(MarqueeSelectionPlugin.create())
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'palette-tool-root',
      props: {
        model: createModelerModel({
          elements: [
            createBasicRectElement({ id: 'rect-1', x: 100, y: 100, width: 160, height: 96 }),
            createBasicRectElement({ id: 'rect-2', x: 400, y: 100, width: 160, height: 96 }),
          ],
        }),
        pluginRuntime: runtime,
        width: 640,
        height: 420,
        options: {
          branding: {
            visible: false,
          },
        },
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(44, 44)?.componentId).toBe('palette-tool-root:palette')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 44, button: 0 }))
    expect((root as unknown as { controllerInstance: ReturnType<typeof createModelerController> }).controllerInstance
      .getPluginContext().tools.getActiveId()).toBe('marqueeSelection')
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 44, clientY: 44, button: 0 }))
    app.raph.run()
    expect((root as unknown as { controllerInstance: ReturnType<typeof createModelerController> }).controllerInstance
      .getPluginContext().tools.getActiveId()).toBe('marqueeSelection')

    const controller = (root as unknown as { controllerInstance: ReturnType<typeof createModelerController> }).controllerInstance
    const context = controller.getPluginContext()
    const startEvent = offsetMouseEvent('mousedown', 80, 80)
    const marqueeGesture = controller.getGestures().find(gesture => gesture.hitTest?.(
      context,
      startEvent,
      controller.hitTest({ x: 80, y: 80 }),
    ))
    expect(marqueeGesture).toBeDefined()
    marqueeGesture?.onPointerDown?.(context, startEvent)
    marqueeGesture?.onPointerMove?.(context, offsetMouseEvent('mousemove', 280, 220))
    marqueeGesture?.onPointerUp?.(context, offsetMouseEvent('mouseup', 280, 220))
    expect(root.getApi().getModel().selection).toEqual(['rect-1'])
    expect(controller.getPluginContext().tools.getActiveId()).toBeNull()
    app.destroy()
  })

  it('activates marquee selection from a custom controls palette slot', () => {
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
    const runtime = createPluginRuntime().use(MarqueeSelectionPlugin.create())
    const controller = createModelerController({ pluginRuntime: runtime })
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'palette-slot-tool-root',
      props: {
        model: createModelerModel(),
        controller,
        pluginRuntime: runtime,
        width: 640,
        height: 420,
      },
      slots: {
        controls: () => [{
          type: Modeler.Palette,
          id: 'slot-palette',
          props: {
            position: 'fixed',
            controller,
            placement: 'left',
            draggable: true,
            zIndex: 3000,
          },
        }],
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(44, 44)?.componentId).toBe('slot-palette')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 44, button: 0 }))
    expect(controller.getPluginContext().tools.getActiveId()).toBe('marqueeSelection')
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 44, clientY: 44, button: 0 }))
    app.raph.run()
    expect(controller.getPluginContext().tools.getActiveId()).toBe('marqueeSelection')
    root.setProps({ options: { version: 1 } })
    app.raph.run()
    expect(controller.getPluginContext().tools.getActiveId()).toBe('marqueeSelection')
    app.destroy()
  })

  it('uses pointer cursor when hovering palette item buttons', () => {
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
      id: 'palette-cursor-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
    })
    app.raph.run()
    app.raph.run()

    const target = app.events.hitTest(44, 116)
    expect(target?.componentId).toBe('palette-cursor-root:palette')
    target?.eventHandlers.mousemove?.(new MouseEvent('mousemove', { clientX: 44, clientY: 116, button: 0 }))
    app.cursors.syncPointer({ x: 44, y: 116, target })
    expect(app.canvas.element.style.cursor).toBe('pointer')

    app.destroy()
  })

  it('temporarily activates marquee selection while Shift is pressed', () => {
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
      id: 'shift-marquee-root',
      props: {
        model: createModelerModel(),
        pluginRuntime: createPluginRuntime().use(MarqueeSelectionPlugin.create()),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const controller = (root as unknown as { controllerInstance: ReturnType<typeof createModelerController> }).controllerInstance
    expect(controller.getPluginContext().tools.getActiveId()).toBeNull()
    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(controller.getPluginContext().tools.getActiveId()).toBe('marqueeSelection')
    app.handleEvent('keyup', new KeyboardEvent('keyup', { key: 'Shift' }))
    expect(controller.getPluginContext().tools.getActiveId()).toBeNull()
    app.destroy()
  })

  it('activates create tools from shortcuts and creates on the next canvas click', () => {
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
      id: 'shortcut-create-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'r' }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 240, clientY: 220, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 240, clientY: 220, button: 0 }))

    const model = root.getApi().getModel()
    expect(model.elements).toHaveLength(1)
    expect(model.elements[0]).toMatchObject({ type: 'basic.rect', x: 160, y: 172 })
    expect(model.selection).toEqual([model.elements[0]?.id])
    app.destroy()
  })

  it('creates basic rect, BPMN event and BPMN gateway by dragging from the default control palette', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0)
        return 1
      })
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
      id: 'palette-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const controller = (root as unknown as { controllerInstance: ReturnType<typeof createModelerController> }).controllerInstance
    const controls = app.surfaces.find(item => item.name === 'palette-root:controls')
    const paletteItems = controls?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(paletteItems.some(item => item.type === 'icon' && item.icon === MODELER_ASSETS.icons.connectArrow)).toBe(true)

    expect(app.events.hitTest(44, 116)?.componentId).toBe('palette-root:palette')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 116, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 44, clientY: 116, button: 0 }))
    expect(root.getApi().getModel().elements).toHaveLength(0)
    expect(controller.getPluginContext().tools.getActiveId()).toBe('connect')

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 157, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 240, clientY: 220, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 240, clientY: 220, button: 0 }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 205, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 360, clientY: 260, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 360, clientY: 260, button: 0 }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 349, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 420, clientY: 300, button: 0 }))
    app.raph.run()
    const previewItems = app.surfaces
      .flatMap(surface => surface.compileRenderFrame().items)
      .map(item => item.schemaItem)
      .filter(Boolean)
    expect(previewItems.some(item => item.type === 'polygon' && item.styles?.opacity !== undefined)).toBe(true)
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 420, clientY: 300, button: 0 }))

    const model = root.getApi().getModel()
    expect(model.elements).toHaveLength(3)
    expect(model.elements[0]?.type).toBe('basic.rect')
    expect(model.elements[0]).toMatchObject({ x: 160, y: 172 })
    expect(model.elements[1]?.type).toBe('bpmn.event')
    expect(model.elements[1]).toMatchObject({ x: 336, y: 236 })
    expect(model.elements[1]?.data).toMatchObject({ eventPosition: 'start', trigger: 'none' })
    expect(model.elements[2]?.type).toBe('bpmn.gateway')
    expect(model.elements[2]).toMatchObject({ x: 392, y: 272 })
    expect(model.elements[2]?.data).toMatchObject({ gatewayType: 'exclusive' })
    expect(model.selection).toEqual([model.elements[2]?.id])
    app.destroy()
    requestAnimationFrameSpy.mockRestore()
  })

  it('creates BPMN flow by dragging from port to port, cancels with Escape and edits waypoints', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0)
        return 1
      })
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
      id: 'flow-create-root',
      props: {
        model: createModelerModel({
          elements: [
            createBpmnEventElement({ id: 'start-1', x: 100, y: 100 }),
            createBpmnTaskElement({ id: 'task-1', x: 220, y: 84 }),
          ],
          selection: ['start-1', 'task-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 148, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 220, clientY: 124, button: 0 }))
    app.raph.run()
    const interaction = app.surfaces.find(item => item.name === 'flow-create-root:interaction')
    const links = app.surfaces.find(item => item.name === 'flow-create-root:links')
    expect(links?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(false)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-1:connection-port:left')).toBe(true)
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 220, clientY: 124, button: 0 }))
    app.raph.run()

    let model = root.getApi().getModel()
    const flow = model.elements.find(element => element.type === 'bpmn.flow')!
    expect(flow).toMatchObject({
      source: { elementId: 'start-1', portId: 'right' },
      target: { elementId: 'task-1', portId: 'left' },
      waypoints: [{ x: 184, y: 124 }],
      data: { flowType: 'sequence' },
    })
    expect(model.selection).toEqual([flow.id])

    root.applyCommand({ type: 'select', ids: ['start-1', 'task-1'] })
    app.raph.run()
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 148, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 220, clientY: 124, button: 0 }))
    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'Escape' }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 220, clientY: 124, button: 0 }))
    expect(root.getApi().getModel().elements.filter(element => element.type === 'bpmn.flow')).toHaveLength(1)

    root.applyCommand({ type: 'select', ids: [flow.id] })
    app.raph.run()
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 184, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 184, clientY: 160, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 184, clientY: 160, button: 0 }))
    model = root.getApi().getModel()
    expect(model.elements.find(element => element.id === flow.id)).toMatchObject({
      waypoints: [{ x: 184, y: 160 }],
    })
    app.destroy()
    requestAnimationFrameSpy.mockRestore()
  })

  it('creates BPMN flow with the connect tool by click-click and drag gestures', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0)
        return 1
      })
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
      id: 'flow-tool-root',
      props: {
        model: createModelerModel({
          elements: [
            createBpmnEventElement({ id: 'start-1', x: 100, y: 100 }),
            createBpmnTaskElement({ id: 'task-1', x: 220, y: 84 }),
            createBpmnGatewayElement({ id: 'gateway-1', x: 420, y: 96 }),
          ],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'c' }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 144, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 144, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 224, clientY: 124, button: 0 }))
    app.raph.run()
    const interaction = app.surfaces.find(item => item.name === 'flow-tool-root:interaction')
    const links = app.surfaces.find(item => item.name === 'flow-tool-root:links')
    expect(links?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(false)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-1:connection-port:left')).toBe(true)
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 224, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 224, clientY: 124, button: 0 }))

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'c' }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 336, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 420, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 420, clientY: 124, button: 0 }))

    const flows = root.getApi().getModel().elements.filter(element => element.type === 'bpmn.flow')
    expect(flows).toHaveLength(2)
    expect(flows[0]).toMatchObject({
      source: { elementId: 'start-1', portId: 'right' },
      target: { elementId: 'task-1', portId: 'left' },
    })
    expect(flows[1]).toMatchObject({
      source: { elementId: 'task-1', portId: 'right' },
      target: { elementId: 'gateway-1', portId: 'left' },
    })
    app.destroy()
    requestAnimationFrameSpy.mockRestore()
  })

  it('starts BPMN flow from the context pad connect action and cancels with Escape', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0)
        return 1
      })
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
      id: 'flow-context-pad-root',
      props: {
        model: createModelerModel({
          elements: [
            createBpmnEventElement({ id: 'start-1', x: 100, y: 100 }),
            createBpmnTaskElement({ id: 'task-1', x: 220, y: 84 }),
          ],
          selection: ['start-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 316, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 316, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 224, clientY: 124, button: 0 }))
    app.raph.run()
    let interaction = app.surfaces.find(item => item.name === 'flow-context-pad-root:interaction')
    let links = app.surfaces.find(item => item.name === 'flow-context-pad-root:links')
    expect(links?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    app.raph.run()
    interaction = app.surfaces.find(item => item.name === 'flow-context-pad-root:interaction')
    links = app.surfaces.find(item => item.name === 'flow-context-pad-root:links')
    expect((root as unknown as { controllerInstance: ReturnType<typeof createModelerController> }).controllerInstance.getPluginContext().tools.getActiveId()).toBeNull()
    expect(links?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(false)
    expect(root.getApi().getModel().elements.filter(element => element.type === 'bpmn.flow')).toHaveLength(0)

    root.applyCommand({ type: 'select', ids: ['start-1'] })
    app.raph.run()
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 316, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 316, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 224, clientY: 124, button: 0 }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 224, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 224, clientY: 124, button: 0 }))
    expect(root.getApi().getModel().elements.filter(element => element.type === 'bpmn.flow')).toHaveLength(1)
    app.destroy()
    requestAnimationFrameSpy.mockRestore()
  })

  it('docks palette by placement and switches between vertical and horizontal layouts', () => {
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
      id: 'palette-placement-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
        options: {
          palette: {
            placement: 'right',
          },
        },
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(596, 120)?.componentId).toBe('palette-placement-root:palette')
    expect(app.events.hitTest(44, 44)?.componentId).not.toBe('palette-placement-root:palette')

    app.destroy()

    const topCanvas = document.createElement('canvas')
    const topApp = Nova.createApp({
      target: topCanvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(topApp.schema)
    const topSurface = topApp.createSurface('modeler')
    topApp.schema.createNode(topSurface, {
      type: Modeler.Root,
      id: 'palette-top-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
        options: {
          palette: {
            placement: 'top',
          },
        },
      },
    })
    topApp.raph.run()
    topApp.raph.run()

    expect(topApp.events.hitTest(44, 44)?.componentId).toBe('palette-top-root:palette')
    expect(topApp.events.hitTest(92, 44)?.componentId).toBe('palette-top-root:palette')
    expect(topApp.events.hitTest(44, 92)?.componentId).not.toBe('palette-top-root:palette')
    topApp.destroy()
  })

  it('drags palette by the grip and resets it on double click', () => {
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
      id: 'palette-drag-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
        options: {
          branding: {
            visible: false,
          },
        },
      },
    })
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(44, 369)?.componentId).toBe('palette-drag-root:palette')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 369, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('grabbing')
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 140, clientY: 392, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 140, clientY: 392, button: 0 }))
    app.raph.run()

    expect(app.events.hitTest(140, 392)?.componentId).toBe('palette-drag-root:palette')
    expect(app.events.hitTest(44, 369)?.componentId).not.toBe('palette-drag-root:palette')

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 140, clientY: 392, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 140, clientY: 392, button: 0 }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 140, clientY: 392, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 140, clientY: 392, button: 0 }))
    app.raph.run()

    expect(app.events.hitTest(44, 369)?.componentId).toBe('palette-drag-root:palette')
    app.destroy()
  })

  it('hides palette grip when dragging is disabled', () => {
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
      id: 'palette-no-drag-root',
      props: {
        model: createModelerModel(),
        width: 640,
        height: 420,
        options: {
          branding: {
            visible: false,
          },
          palette: {
            draggable: false,
          },
        },
      },
    })
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(44, 44)?.componentId).toBe('palette-no-drag-root:palette')
    expect(app.events.hitTest(44, 380)?.componentId).not.toBe('palette-no-drag-root:palette')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 380, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 140, clientY: 408, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 140, clientY: 408, button: 0 }))
    app.raph.run()

    expect(app.events.hitTest(140, 180)?.componentId).not.toBe('palette-no-drag-root:palette')
    expect(app.events.hitTest(44, 44)?.componentId).toBe('palette-no-drag-root:palette')
    app.destroy()
  })

  it('registers modeler settings dialog categories and DSL sections', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('settings')
    app.schema.createNode(surface, {
      type: NovaUIKit.Root,
      id: 'settings-root',
      props: {
        width: 640,
        height: 420,
      },
      children: [{
        type: Modeler.SettingsDialog,
        id: 'settings-dialog',
        children: [{
          type: Modeler.SettingsSection,
          props: {
            id: 'canvas.grid',
            category: 'canvas',
            title: 'Grid',
            order: 10,
          },
          slots: {
            default: slot => [{
              type: NovaUIKit.TextBlock,
              id: `settings-section:${slot.section.id}`,
              props: {
                text: String(slot.settings.grid),
                width: 120,
                height: 24,
              },
            }],
          },
        }],
        slots: {
          default: () => [{
            type: Modeler.SettingsSection,
            props: {
              id: 'view.debug',
              category: 'view',
              title: 'Debug',
              order: 10,
            },
          }],
        },
      }],
    })
    app.raph.run()

    const settingsApi = app.components.requireApi<ModelerSettingsDialogApi>('settings-dialog')
    expect(settingsApi.getProps().width).toBe(760)
    expect(settingsApi.getProps().height).toBe(520)
    expect(settingsApi.getRegistry().getCategories().map(category => category.id)).toEqual([
      'canvas',
      'interaction',
      'view',
      'theme',
    ])
    expect(settingsApi.getRegistry().getSections('canvas').map(section => section.id)).toEqual(['canvas.grid'])
    expect(settingsApi.getRegistry().getSections('view').map(section => section.id)).toEqual(['view.debug'])

    const rootApi = app.components.requireApi<{ openDialog: (type: string, payload?: Record<string, unknown>) => string }>('settings-root')
    expect(rootApi.openDialog('modeler-settings', { settings: { grid: true } })).toBe('dialog-1')
    app.raph.run()
    app.raph.run()
    expect(app.components.get('settings-section:canvas.grid')).toBeTruthy()
    const viewCategoryApi = app.components.requireApi<{
      press: () => void
      getProps: () => { textAlign?: string }
    }>('dialog-1:settings-category:view')
    expect(viewCategoryApi.getProps().textAlign).toBe('left')
    viewCategoryApi.press()
    app.raph.run()
    app.raph.run()
    expect(app.components.get('dialog-1:settings-section-title:view.debug')).toBeTruthy()
    app.destroy()
  })

  it('opens, updates and closes settings dialog through controller', () => {
    const root = {
      ids: [] as Array<string>,
      patches: [] as Array<Record<string, unknown>>,
      openDialog(input: { id?: string; type?: string } & Record<string, unknown>) {
        this.ids = [input.id ?? 'dialog']
        return this.ids[0]
      },
      closeDialog(id?: string) {
        this.ids = this.ids.filter(item => item !== id)
      },
      updateDialog(_id: string, patch: Record<string, unknown>) {
        this.patches.push(patch)
      },
      getOpenDialogIds() {
        return this.ids
      },
    }
    const controller = createModelerSettingsController({ root: () => root })

    expect(controller.open({ settings: { grid: true } })).toBe('modeler-settings')
    expect(controller.isOpen()).toBe(true)
    controller.update({ activeCategoryId: 'interaction' })
    expect(root.patches).toEqual([{ activeCategoryId: 'interaction' }])
    expect(controller.toggle()).toBeNull()
    expect(controller.isOpen()).toBe(false)
    expect(controller.toggle({ activeCategoryId: 'view' })).toBe('modeler-settings')
    controller.close()
    expect(controller.isOpen()).toBe(false)

    const detached = createModelerSettingsController({ root: () => null })
    expect(detached.open()).toBeNull()
    expect(detached.isOpen()).toBe(false)
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
    const root = app.schema.createNode(surface, {
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
    }) as { setProps: (patch: Record<string, unknown>) => void }
    app.raph.run()
    app.raph.run()

    const toolbarTarget = app.events.hitTest(606, 34)
    expect(toolbarTarget?.componentId).toBe('toolbar-settings')
    app.cursors.syncPointer({ x: 606, y: 34, target: toolbarTarget })
    expect(app.canvas.element.style.cursor).toBe('pointer')
    root.setProps({ width: 640, height: 420 })
    app.raph.run()
    expect(app.events.hitTest(606, 34)).toBe(toolbarTarget)
    expect(app.canvas.element.style.cursor).toBe('pointer')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 606, clientY: 34, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('pointer')
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 606, clientY: 34, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('pointer')
    expect(settingsPress).toHaveBeenCalledTimes(1)

    const panelTarget = app.events.hitTest(500, 113)
    expect(panelTarget?.componentId).toBe('panel-fps')
    app.cursors.syncPointer({ x: 500, y: 113, target: panelTarget })
    expect(app.canvas.element.style.cursor).toBe('pointer')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 500, clientY: 113, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 500, clientY: 113, button: 0 }))
    expect(panelPress).toHaveBeenCalledTimes(1)

    expect(['toolbar', 'settings-panel', 'panel-fps']).not.toContain(app.events.hitTest(64, 113)?.componentId)
    app.destroy()
  })

  it('keeps modeler controls above the modeler root after UI Kit dialog registry mounts', () => {
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

    app.schema.createNode(surface, {
      type: NovaUIKit.Root,
      id: 'controls-dialog-ui-root',
      props: { width: 640, height: 420 },
      children: [
        {
          type: NovaUIKit.Dialogs,
          id: 'controls-dialog-registry',
          props: {
            definitions: [{ type: 'settings', props: { width: 320, height: 200 } }],
          },
        },
        {
          type: Modeler.Root,
          id: 'controls-dialog-modeler-root',
          props: {
            model: createModelerModel(),
            width: 640,
            height: 420,
          },
          slots: {
            controls: () => [{
              type: NovaUIKit.Flex,
              id: 'controls-dialog-toolbar',
              props: {
                position: 'fixed',
                inset: { top: 16, right: 16 },
                height: 36,
                zIndex: 3000,
              },
              children: [{
                type: NovaUIKit.Button,
                id: 'controls-dialog-settings',
                props: {
                  width: 36,
                  height: 36,
                  position: 'static',
                  onPress: settingsPress,
                },
              }],
            }],
          },
        },
      ],
    })
    app.raph.run()
    app.raph.run()

    expect(surface.weight).toBe(0)
    expect(app.surfaces.find(item => item.name === 'controls-dialog-ui-root:nova-ui-dialog-portal')?.weight).toBe(30_000)
    expect(app.events.hitTest(606, 34)?.componentId).toBe('controls-dialog-settings')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 606, clientY: 34, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 606, clientY: 34, button: 0 }))
    expect(settingsPress).toHaveBeenCalledTimes(1)

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
      mount: vi.fn(() => ({ remove: vi.fn() })),
      unmount: vi.fn(),
      reconcile: vi.fn(() => vi.fn()),
    },
  }
}

function offsetMouseEvent(type: string, x: number, y: number, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent(type, { button: 0, clientX: x, clientY: y, ...init })
  Object.defineProperties(event, {
    offsetX: { value: x },
    offsetY: { value: y },
  })
  return event
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
