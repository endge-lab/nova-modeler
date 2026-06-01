import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Nova, RaphSchedulerType, RendererType, boundsContainsPoint, type NovaSchema } from '@endge/nova'
import { NovaUIKit, type ColorPickerApi, type DialogApi, type InputApi } from '@endge/nova-ui-kit'
import {
  Modeler,
  BPMN_VALIDATION_RESULT_KEY,
  BpmnExporter,
  BpmnValidationPlugin,
  BpmnValidationRuntime,
  GridSnapStrategy,
  MarqueeSelectionPlugin,
  MiniMapPlugin,
  Root,
  SelectionRuntime,
  SnapRuntime,
  applyModelerCommand,
  appendGridSchema,
  createBpmnEventElement,
  createBpmnEventVariantOptions,
  createBpmnBoundaryEventElement,
  createBpmnFlowElement,
  createBpmnGatewayElement,
  createBpmnAssociationElement,
  createBpmnDataAssociationElement,
  createBpmnMessageFlowElement,
  canConnectBpmnMessageFlow,
  createBpmnDataObjectElement,
  createBpmnDataStoreElement,
  createBpmnGroupElement,
  addBpmnParticipantLane,
  createBpmnParticipantElement,
  createBpmnCallActivityElement,
  createBpmnSubProcessElement,
  createBpmnTextAnnotationElement,
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
  MODEL_ELEMENTS_RUNTIME,
  ModelerPngExporter,
  PluginBase,
  normalizeModelerModel,
  normalizeModelerOptions,
  registerModeler,
  resolveBpmnActivityNameLayout,
  resolveBpmnTaskNameLayout,
  type ModelerRect,
  type ModelerSettingsDialogApi,
  type ModelerValidationResult,
} from '@/index'

describe('nova modeler minimal kernel', () => {
  beforeEach(() => {
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:nova-modeler-test')
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn()
    MODEL_ELEMENTS_RUNTIME.connectionWarnings.clear()
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
      bpmnDefinitions: [],
      version: 0,
      viewportVersion: 0,
      bpmnDefinitionsVersion: 0,
      elementsVersion: 0,
      selectionVersion: 0,
    })
    const withDefinitions = applyModelerCommand(model, {
      type: 'bpmn.definitions.set',
      definitions: [
        { id: 'customer-message', kind: 'message', name: 'Customer message' },
        { id: 'customer-message', kind: 'message', name: 'Duplicate message' },
        { id: 'critical-signal', kind: 'signal', name: 'Critical signal' },
      ],
    })
    expect(withDefinitions.bpmnDefinitions).toEqual([
      { id: 'customer-message', kind: 'message', name: 'Customer message', code: undefined },
      { id: 'critical-signal', kind: 'signal', name: 'Critical signal', code: undefined },
    ])
    expect(withDefinitions.bpmnDefinitionsVersion).toBe(1)
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

  it('exports BPMN 2.0 XML with DI bounds and waypoints', () => {
    const start = createBpmnEventElement({ id: 'start', x: 40, y: 90, eventPosition: 'start' })
    const task = createBpmnTaskElement({ id: 'task', x: 160, y: 74, name: 'Review request', taskType: 'user' })
    const flow = createBpmnFlowElement({
      id: 'flow',
      source: { elementId: start.id, point: { x: 88, y: 114 } },
      target: { elementId: task.id, point: { x: 160, y: 114 } },
      waypoints: [{ x: 124, y: 114 }],
    })
    const model = createModelerModel({ id: 'export-demo', elements: [start, task, flow] })
    const xml = new BpmnExporter().export({ model })

    expect(xml).toContain('<process id="Process_export-demo" isExecutable="false">')
    expect(xml).toContain('<startEvent id="Event_start" />')
    expect(xml).toContain('<userTask id="Task_task" name="Review request" />')
    expect(xml).toContain('<sequenceFlow id="Flow_flow" sourceRef="Event_start" targetRef="Task_task" />')
    expect(xml).toContain('<bpmndi:BPMNShape id="Task_task_di" bpmnElement="Task_task">')
    expect(xml).toContain('<di:waypoint x="88" y="114" />')
    expect(xml).toContain('<di:waypoint x="124" y="114" />')
    expect(xml).toContain('<di:waypoint x="160" y="114" />')
  })

  it('exports BPMN event definitions with catch and throw intermediate tags', () => {
    const catchEvent = createBpmnEventElement({
      id: 'catch-message',
      eventPosition: 'intermediate',
      trigger: 'message',
      direction: 'catch',
    })
    const throwEvent = createBpmnEventElement({
      id: 'throw-message',
      eventPosition: 'intermediate',
      trigger: 'message',
      direction: 'throw',
    })
    const endEvent = createBpmnEventElement({
      id: 'terminate-end',
      eventPosition: 'end',
      trigger: 'terminate',
      direction: 'throw',
    })
    const xml = new BpmnExporter().export({
      model: createModelerModel({ id: 'event-definitions', elements: [catchEvent, throwEvent, endEvent] }),
    })

    expect(xml).toContain('<intermediateCatchEvent id="Event_catch-message">')
    expect(xml).toContain('<intermediateThrowEvent id="Event_throw-message">')
    expect(xml).toContain('<messageEventDefinition />')
    expect(xml).toContain('<endEvent id="Event_terminate-end">')
    expect(xml).toContain('<terminateEventDefinition />')
  })

  it('exports BPMN default and conditional sequence flow metadata', () => {
    const gateway = createBpmnGatewayElement({ id: 'decision', x: 220, y: 90 })
    const approve = createBpmnTaskElement({ id: 'approve', x: 340, y: 74, name: 'Approve' })
    const reject = createBpmnTaskElement({ id: 'reject', x: 340, y: 174, name: 'Reject' })
    const defaultFlow = createBpmnFlowElement({
      id: 'default-path',
      flowType: 'defaultSequence',
      source: { elementId: gateway.id, point: { x: 276, y: 118 } },
      target: { elementId: approve.id, point: { x: 340, y: 118 } },
      data: { name: 'Default path' },
    })
    const conditionalFlow = createBpmnFlowElement({
      id: 'reject-path',
      flowType: 'conditionalSequence',
      source: { elementId: gateway.id, point: { x: 248, y: 146 } },
      target: { elementId: reject.id, point: { x: 340, y: 218 } },
      data: { name: 'Needs changes', conditionExpression: '${ approved == false }' },
    })
    const xml = new BpmnExporter().export({
      model: createModelerModel({
        id: 'sequence-flow-metadata',
        elements: [gateway, approve, reject, defaultFlow, conditionalFlow],
      }),
    })

    expect(xml).toContain('<exclusiveGateway id="Gateway_decision" default="Flow_default-path" />')
    expect(xml).toContain('<sequenceFlow id="Flow_default-path" name="Default path" sourceRef="Gateway_decision" targetRef="Task_approve" />')
    expect(xml).toContain('<sequenceFlow id="Flow_reject-path" name="Needs changes" sourceRef="Gateway_decision" targetRef="Task_reject">')
    expect(xml).toContain('<conditionExpression xsi:type="tFormalExpression">${ approved == false }</conditionExpression>')
  })

  it('exports BPMN global event definitions and references', () => {
    const task = createBpmnTaskElement({ id: 'task', x: 160, y: 74, name: 'Review request' })
    const messageStart = createBpmnEventElement({
      id: 'message-start',
      eventPosition: 'start',
      trigger: 'message',
      direction: 'catch',
      messageRef: 'customer-message',
    })
    const signalBoundary = createBpmnBoundaryEventElement({
      id: 'signal-boundary',
      attachedToRef: task.id,
      trigger: 'signal',
      signalRef: 'critical-signal',
    })
    const escalationEnd = createBpmnEventElement({
      id: 'escalation-end',
      eventPosition: 'end',
      trigger: 'escalation',
      direction: 'throw',
      escalationRef: 'level-two',
    })
    const xml = new BpmnExporter().export({
      model: createModelerModel({
        id: 'global-definitions',
        bpmnDefinitions: [
          { id: 'customer-message', kind: 'message', name: 'Customer message' },
          { id: 'critical-signal', kind: 'signal', name: 'Critical signal' },
          { id: 'level-two', kind: 'escalation', name: 'Level two', code: 'L2' },
        ],
        elements: [messageStart, task, signalBoundary, escalationEnd],
      }),
    })

    expect(xml).toContain('<message id="Message_customer-message" name="Customer message" />')
    expect(xml).toContain('<signal id="Signal_critical-signal" name="Critical signal" />')
    expect(xml).toContain('<escalation id="Escalation_level-two" name="Level two" escalationCode="L2" />')
    expect(xml).toContain('<messageEventDefinition messageRef="Message_customer-message" />')
    expect(xml).toContain('<signalEventDefinition signalRef="Signal_critical-signal" />')
    expect(xml).toContain('<escalationEventDefinition escalationRef="Escalation_level-two" />')
  })

  it('exports BPMN collaboration participants and message flows', () => {
    const poolA = createBpmnParticipantElement({ id: 'sales', x: 80, y: 80, name: 'Sales' })
    const poolB = createBpmnParticipantElement({ id: 'support', x: 80, y: 380, name: 'Support' })
    const sourceTask = createBpmnTaskElement({ id: 'send-request', x: 240, y: 120, name: 'Send request' })
    const targetTask = createBpmnTaskElement({ id: 'receive-request', x: 240, y: 420, name: 'Receive request' })
    const messageFlow = createBpmnMessageFlowElement({
      id: 'request-flow',
      source: { elementId: sourceTask.id, point: { x: 290, y: 190 } },
      target: { elementId: targetTask.id, point: { x: 290, y: 420 } },
      waypoints: [{ x: 290, y: 300 }],
      messageRef: 'request-message',
    })
    const xml = new BpmnExporter().export({
      model: createModelerModel({
        id: 'message-flow-export',
        bpmnDefinitions: [{ id: 'request-message', kind: 'message', name: 'Request message' }],
        elements: [poolA, poolB, sourceTask, targetTask, messageFlow],
      }),
    })

    expect(xml).toContain('<collaboration id="Process_message-flow-export_Collaboration">')
    expect(xml).toContain('<participant id="Participant_sales" name="Sales" processRef="Process_message-flow-export" />')
    expect(xml).toContain('<participant id="Participant_support" name="Support" processRef="Process_message-flow-export" />')
    expect(xml).toContain('<messageFlow id="MessageFlow_request-flow" sourceRef="Task_send-request" targetRef="Task_receive-request" messageRef="Message_request-message" />')
    expect(xml).toContain('<process id="Process_message-flow-export" isExecutable="false">')
    expect(xml).toContain('<bpmndi:BPMNPlane id="Process_message-flow-export_Plane" bpmnElement="Process_message-flow-export_Collaboration">')
    expect(xml).toContain('<bpmndi:BPMNEdge id="MessageFlow_request-flow_di" bpmnElement="MessageFlow_request-flow">')
  })

  it('exports BPMN data objects, data stores and data associations', () => {
    const dataObject = createBpmnDataObjectElement({ id: 'payload', x: 80, y: 80, name: 'Payload' })
    const task = createBpmnTaskElement({ id: 'task', x: 240, y: 90, name: 'Handle payload' })
    const dataStore = createBpmnDataStoreElement({ id: 'archive', x: 440, y: 82, name: 'Archive' })
    const inputAssociation = createBpmnDataAssociationElement({
      id: 'input',
      source: { elementId: dataObject.id, point: { x: 176, y: 140 } },
      target: { elementId: task.id, point: { x: 240, y: 130 } },
      dataAssociationType: 'input',
    })
    const outputAssociation = createBpmnDataAssociationElement({
      id: 'output',
      source: { elementId: task.id, point: { x: 340, y: 130 } },
      target: { elementId: dataStore.id, point: { x: 440, y: 130 } },
      dataAssociationType: 'output',
    })
    const xml = new BpmnExporter().export({
      model: createModelerModel({
        id: 'data-associations',
        elements: [dataObject, task, dataStore, inputAssociation, outputAssociation],
      }),
    })

    expect(xml).toContain('<dataObjectReference id="DataObject_payload" name="Payload" />')
    expect(xml).toContain('<dataStoreReference id="DataStore_archive" name="Archive" />')
    expect(xml).toContain('<task id="Task_task" name="Handle payload">')
    expect(xml).toContain('<dataInputAssociation id="DataAssociation_input">')
    expect(xml).toContain('<sourceRef>DataObject_payload</sourceRef>')
    expect(xml).toContain('<targetRef>Task_task</targetRef>')
    expect(xml).toContain('<dataOutputAssociation id="DataAssociation_output">')
    expect(xml).toContain('<sourceRef>Task_task</sourceRef>')
    expect(xml).toContain('<targetRef>DataStore_archive</targetRef>')
    expect(xml).toContain('<bpmndi:BPMNEdge id="DataAssociation_input_di" bpmnElement="DataAssociation_input">')
  })

  it('exports PNG on a white tight canvas with padding', async () => {
    const ctx = create2DContextStub()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback, mime?: string) {
      callback(new Blob(['png'], { type: mime ?? 'image/png' }))
    })
    const model = createModelerModel({
      id: 'png-demo',
      elements: [
        createBpmnEventElement({ id: 'start', x: 40, y: 90 }),
        createBpmnTaskElement({ id: 'task', x: 160, y: 74, name: 'Review request' }),
      ],
    })

    const blob = await new ModelerPngExporter().export({ model }, { padding: 10 })

    expect(blob.type).toBe('image/png')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 260, 100)
    expect(ctx.translate).toHaveBeenCalledWith(-30, -64)
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
    expect(MODELER_ASSETS.icons.event).toBeTruthy()
    expect(context.palette.get('bpmn.event.create')).toMatchObject({
      title: 'Event',
      icon: 'bpmn-event',
      toolId: 'create:bpmn.event',
    })
    expect(context.palette.get('bpmn.event.intermediate.create')).toBeUndefined()
    expect(context.palette.get('bpmn.event.end.create')).toBeUndefined()
    expect(context.tools.createAt('create:bpmn.event', { x: 360, y: 220 })).toMatchObject({
      type: 'bpmn.event',
      data: {
        eventPosition: 'start',
        trigger: 'none',
        direction: 'catch',
      },
    })
    controller.applyCommand({ type: 'select', ids: ['event-1'] })

    const draft = provider?.createDraft?.(context, event) ?? {}
    const descriptor = provider?.getDescriptor(context, event, draft)
    const positionControl = descriptor?.controls.find(control => control.id === 'eventPosition')
    const triggerControl = descriptor?.controls.find(control => control.id === 'trigger')
    expect(positionControl?.kind).toBe('choice')
    expect(triggerControl?.title).toBe('Event definition')
    expect(positionControl?.options.map(option => option.id)).toEqual(['start', 'intermediate', 'end'])
    expect(triggerControl?.options.some(option => option.id === 'start:timer:catch')).toBe(true)
    expect(triggerControl?.options.some(option => option.id === 'start:error:throw')).toBe(false)
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

    const timerDraft = provider?.createDraft?.(context, next.elements[0] as typeof event) ?? {}
    const timerDescriptor = provider?.getDescriptor(context, next.elements[0] as typeof event, timerDraft)
    const endOption = timerDescriptor?.controls.find(control => control.id === 'eventPosition')?.options.find(option => option.id === 'end')
    const normalizedEndDraft = provider?.updateDraft?.(context, next.elements[0] as typeof event, timerDraft, positionControl!, endOption!)
    expect(normalizedEndDraft).toMatchObject({
      eventPosition: 'end',
      trigger: 'none',
      direction: 'throw',
    })

    const messageEvent = createBpmnEventElement({
      id: 'message-event',
      eventPosition: 'start',
      trigger: 'message',
      direction: 'catch',
    })
    const messageDraft = provider?.createDraft?.(context, messageEvent) ?? {}
    const messageDescriptor = provider?.getDescriptor(context, messageEvent, messageDraft)
    const messageEndOption = messageDescriptor?.controls.find(control => control.id === 'eventPosition')?.options.find(option => option.id === 'end')
    expect(provider?.updateDraft?.(context, messageEvent, messageDraft, positionControl!, messageEndOption!)).toMatchObject({
      eventPosition: 'end',
      trigger: 'message',
      direction: 'throw',
    })

    const intermediateOptions = createBpmnEventVariantOptions('intermediate', event)
    expect(intermediateOptions.map(option => option.id)).toEqual(expect.arrayContaining([
      'intermediate:message:catch',
      'intermediate:message:throw',
      'intermediate:link:catch',
      'intermediate:link:throw',
    ]))
    controller.unmount()
  })

  it('normalizes impossible BPMN event definitions to the nearest valid event', () => {
    expect(createBpmnEventElement({
      id: 'bad-start',
      eventPosition: 'start',
      trigger: 'error',
      direction: 'throw',
    }).data).toMatchObject({
      eventPosition: 'start',
      trigger: 'none',
      direction: 'catch',
    })
    expect(createBpmnEventElement({
      id: 'bad-end',
      eventPosition: 'end',
      trigger: 'timer',
      direction: 'catch',
    }).data).toMatchObject({
      eventPosition: 'end',
      trigger: 'none',
      direction: 'throw',
    })
    expect(createBpmnEventElement({
      id: 'message-end',
      eventPosition: 'end',
      trigger: 'message',
      direction: 'catch',
    }).data).toMatchObject({
      eventPosition: 'end',
      trigger: 'message',
      direction: 'throw',
    })
    expect(createBpmnEventElement({
      id: 'message-throw',
      eventPosition: 'intermediate',
      trigger: 'message',
      direction: 'throw',
    }).data).toMatchObject({
      eventPosition: 'intermediate',
      trigger: 'message',
      direction: 'throw',
    })
  })

  it('creates and renames BPMN global definitions from event variants', () => {
    const event = createBpmnEventElement({
      id: 'event-1',
      x: 120,
      y: 140,
      eventPosition: 'start',
      trigger: 'none',
    })
    const controller = createModelerController({
      model: createModelerModel({
        bpmnDefinitions: [{ id: 'existing-signal', kind: 'signal', name: 'Existing signal' }],
        elements: [event],
        selection: [event.id],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()
    const provider = context.elementVariants.getProvider(event)!
    const draft = provider.createDraft?.(context, event) ?? {}
    const descriptor = provider.getDescriptor(context, event, draft)
    const triggerControl = descriptor.controls.find(control => control.id === 'trigger')!
    const messageOption = triggerControl.options.find(option => option.id === 'start:message:catch')!

    provider.apply({
      context,
      element: event,
      draft,
      control: triggerControl,
      option: messageOption,
    })
    let model = controller.getModel()
    expect(model.bpmnDefinitions).toEqual([
      { id: 'existing-signal', kind: 'signal', name: 'Existing signal', code: undefined },
      { id: 'message-event-1', kind: 'message', name: 'Message', code: undefined },
    ])
    expect(model.elements[0]).toMatchObject({
      data: {
        trigger: 'message',
        messageRef: 'message-event-1',
      },
    })

    const current = model.elements[0] as typeof event
    const currentDraft = provider.createDraft?.(context, current) ?? {}
    const currentDescriptor = provider.getDescriptor(context, current, currentDraft)
    expect(currentDescriptor.controls.map(control => control.id)).toEqual([
      'eventPosition',
      'trigger',
      'messageRef',
      'definitionName',
    ])
    const nameControl = currentDescriptor.controls.find(control => control.id === 'definitionName')!
    provider.apply({
      context,
      element: current,
      draft: currentDraft,
      control: nameControl,
      option: {
        id: 'definitionName:input',
        title: 'Customer request',
        data: { definitionName: 'Customer request' },
      },
    })
    model = controller.getModel()
    expect(model.bpmnDefinitions.find(definition => definition.id === 'message-event-1')).toMatchObject({
      kind: 'message',
      name: 'Customer request',
    })

    const signalEvent = model.elements[0] as typeof event
    const signalDraft = provider.createDraft?.(context, signalEvent) ?? {}
    const signalDescriptor = provider.getDescriptor(context, signalEvent, signalDraft)
    const signalOption = signalDescriptor.controls.find(control => control.id === 'trigger')?.options.find(option => option.id === 'start:signal:catch')!
    provider.apply({
      context,
      element: signalEvent,
      draft: signalDraft,
      control: triggerControl,
      option: signalOption,
    })
    expect(controller.getModel().elements[0]).toMatchObject({
      data: {
        trigger: 'signal',
        signalRef: 'existing-signal',
      },
    })
    controller.unmount()
  })

  it('adds, changes, moves and exports BPMN boundary events attached to activities', () => {
    const task = createBpmnTaskElement({ id: 'task-1', x: 220, y: 100, name: 'Task' })
    const boundary = createBpmnBoundaryEventElement({
      id: 'boundary-1',
      x: 262,
      y: 162,
      attachedToRef: task.id,
      trigger: 'timer',
    })
    expect(boundary).toMatchObject({
      type: 'bpmn.boundaryEvent',
      width: 36,
      height: 36,
      data: {
        attachedToRef: 'task-1',
        eventPosition: 'intermediate',
        trigger: 'timer',
        direction: 'catch',
        isInterrupting: true,
      },
    })

    const controller = createModelerController({
      model: createModelerModel({
        elements: [task, boundary],
        selection: [boundary.id],
      }),
      options: {
        interaction: { snap: false },
      },
    })
    controller.mount(createControllerHost(760, 420))
    const context = controller.getPluginContext()
    expect(context.palette.get('bpmn.boundaryEvent.create')).toBeUndefined()
    const provider = context.elementVariants.getProvider(boundary)
    expect(provider?.id).toBe('bpmn.boundaryEvent.variants')
    const draft = provider?.createDraft?.(context, boundary) ?? {}
    const descriptor = provider?.getDescriptor(context, boundary, draft)
    const definitionControl = descriptor?.controls.find(control => control.id === 'trigger')
    const interruptingControl = descriptor?.headerControls?.find(control => control.id === 'isInterrupting')
    expect(definitionControl?.options.map(option => option.id)).toEqual([
      'message',
      'timer',
      'error',
      'escalation',
      'cancel',
      'compensation',
      'conditional',
      'signal',
    ])
    expect(definitionControl?.options.some(option => option.id === 'none')).toBe(false)
    provider?.apply({
      context,
      element: boundary,
      draft,
      control: interruptingControl!,
      option: interruptingControl!.options[0]!,
    })
    expect(controller.getModel().elements[1]).toMatchObject({
      id: 'boundary-1',
      data: {
        isInterrupting: false,
        trigger: 'timer',
      },
    })

    controller.applyCommand({ type: 'select', ids: ['task-1'] })
    const moveGesture = controller.getGestures().find(gesture => gesture.id === 'modeler-elements:move')
    moveGesture?.onPointerDown?.(context, offsetMouseEvent('mousedown', 240, 120))
    moveGesture?.onPointerMove?.(context, offsetMouseEvent('mousemove', 270, 150))
    moveGesture?.onPointerUp?.(context, offsetMouseEvent('mouseup', 270, 150))
    expect(controller.getModel().elements).toMatchObject([
      { id: 'task-1', x: 250, y: 130 },
      { id: 'boundary-1', x: 292, y: 192 },
    ])

    const xml = new BpmnExporter().export({
      model: createModelerModel({
        id: 'boundary-export',
        elements: controller.getModel().elements,
      }),
    })
    expect(xml).toContain('<boundaryEvent id="BoundaryEvent_boundary-1" attachedToRef="Task_task-1" cancelActivity="false">')
    expect(xml).toContain('<timerEventDefinition />')

    controller.applyCommand({ type: 'element.delete', id: 'task-1' })
    expect(controller.getModel().elements.find(element => element.id === 'boundary-1')).toBeUndefined()
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
    expect(provider?.id).toBe('bpmn.activity.variants')
    expect(context.palette.get('bpmn.activity.create')).toMatchObject({
      icon: 'bpmn-activity',
      toolId: 'create:bpmn.activity',
    })
    expect(context.palette.get('bpmn.task.create')).toBeUndefined()
    expect(context.tools.createAt('create:bpmn.activity', { x: 360, y: 220 })?.type).toBe('bpmn.task')
    controller.applyCommand({ type: 'select', ids: ['task-1'] })

    const ports = controller.getElementRegistry().require('bpmn.task').getPorts?.(context, task) ?? []
    expect(ports.map(port => port.id)).toEqual(['top', 'right', 'bottom', 'left'])

    const draft = provider?.createDraft?.(context, task) ?? {}
    const descriptor = provider?.getDescriptor(context, task, draft)
    const activityControl = descriptor?.controls.find(control => control.id === 'activityKind')
    const typeControl = descriptor?.controls.find(control => control.id === 'taskType')
    const loopControl = descriptor?.headerControls?.find(control => control.id === 'loopType')
    expect(activityControl?.kind).toBe('choice')
    expect(activityControl?.options.map(option => option.id)).toEqual([
      'task',
      'subProcess',
      'eventSubProcess',
      'transaction',
      'adHocSubProcess',
      'callActivity',
    ])
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

  it('switches BPMN activity root variants while preserving identity and behavior', () => {
    const task = createBpmnTaskElement({
      id: 'activity-1',
      x: 160,
      y: 120,
      name: 'Review request',
      style: { fill: '#f8fafc', stroke: '#334155' },
    })
    const controller = createModelerController({
      model: createModelerModel({
        elements: [task],
        selection: [task.id],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()

    let current = controller.getModel().elements[0]!
    let provider = context.elementVariants.getProvider(current)
    expect(provider?.id).toBe('bpmn.activity.variants')
    let draft = provider?.createDraft?.(context, current) ?? {}
    let descriptor = provider?.getDescriptor(context, current, draft)
    let activityControl = descriptor?.controls.find(control => control.id === 'activityKind')
    expect(activityControl?.kind).toBe('choice')
    expect(activityControl?.options.every(option => Boolean(option.icon))).toBe(true)

    provider?.apply({
      context,
      element: current,
      draft,
      control: activityControl!,
      option: activityControl!.options.find(option => option.id === 'subProcess')!,
    })
    current = controller.getModel().elements[0]!
    expect(current).toMatchObject({
      id: 'activity-1',
      type: 'bpmn.subProcess',
      x: 160,
      y: 120,
      width: 160,
      height: 100,
      data: {
        name: 'Review request',
        subProcessType: 'embedded',
      },
      style: { fill: '#f8fafc', stroke: '#334155' },
    })
    expect(controller.getModel().selection).toEqual(['activity-1'])
    expect(context.elementVariants.getProvider(current)?.id).toBe('bpmn.activity.variants')
    expect(controller.getElementRegistry().require('bpmn.subProcess').capabilities?.resizable).toMatchObject({
      minWidth: 96,
      minHeight: 64,
    })

    provider = context.elementVariants.getProvider(current)
    draft = provider?.createDraft?.(context, current) ?? {}
    descriptor = provider?.getDescriptor(context, current, draft)
    activityControl = descriptor?.controls.find(control => control.id === 'activityKind')
    provider?.apply({
      context,
      element: current,
      draft,
      control: activityControl!,
      option: activityControl!.options.find(option => option.id === 'transaction')!,
    })
    current = controller.getModel().elements[0]!
    expect(current).toMatchObject({
      type: 'bpmn.subProcess',
      data: { subProcessType: 'transaction' },
    })

    provider = context.elementVariants.getProvider(current)
    draft = provider?.createDraft?.(context, current) ?? {}
    descriptor = provider?.getDescriptor(context, current, draft)
    activityControl = descriptor?.controls.find(control => control.id === 'activityKind')
    provider?.apply({
      context,
      element: current,
      draft,
      control: activityControl!,
      option: activityControl!.options.find(option => option.id === 'eventSubProcess')!,
    })
    expect(controller.getModel().elements[0]).toMatchObject({
      type: 'bpmn.subProcess',
      data: { subProcessType: 'event' },
    })

    current = controller.getModel().elements[0]!
    provider = context.elementVariants.getProvider(current)
    draft = provider?.createDraft?.(context, current) ?? {}
    descriptor = provider?.getDescriptor(context, current, draft)
    activityControl = descriptor?.controls.find(control => control.id === 'activityKind')
    provider?.apply({
      context,
      element: current,
      draft,
      control: activityControl!,
      option: activityControl!.options.find(option => option.id === 'adHocSubProcess')!,
    })
    expect(controller.getModel().elements[0]).toMatchObject({
      type: 'bpmn.subProcess',
      data: { subProcessType: 'adHoc' },
    })

    current = controller.getModel().elements[0]!
    provider = context.elementVariants.getProvider(current)
    draft = provider?.createDraft?.(context, current) ?? {}
    descriptor = provider?.getDescriptor(context, current, draft)
    activityControl = descriptor?.controls.find(control => control.id === 'activityKind')
    provider?.apply({
      context,
      element: current,
      draft,
      control: activityControl!,
      option: activityControl!.options.find(option => option.id === 'callActivity')!,
    })
    current = controller.getModel().elements[0]!
    expect(current).toMatchObject({
      id: 'activity-1',
      type: 'bpmn.callActivity',
      data: { name: 'Review request' },
    })
    expect(context.elementVariants.getProvider(current)?.id).toBe('bpmn.activity.variants')
    expect(controller.getElementRegistry().require('bpmn.callActivity').capabilities?.resizable).toMatchObject({
      minWidth: 96,
      minHeight: 64,
    })

    provider = context.elementVariants.getProvider(current)
    draft = provider?.createDraft?.(context, current) ?? {}
    descriptor = provider?.getDescriptor(context, current, draft)
    activityControl = descriptor?.controls.find(control => control.id === 'activityKind')
    provider?.apply({
      context,
      element: current,
      draft,
      control: activityControl!,
      option: activityControl!.options.find(option => option.id === 'task')!,
    })
    expect(controller.getModel().elements[0]).toMatchObject({
      id: 'activity-1',
      type: 'bpmn.task',
      width: 120,
      height: 80,
      data: { name: 'Review request' },
      style: { fill: '#f8fafc', stroke: '#334155' },
    })

    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('activity-menu')
    app.schema.createNode(surface, {
      type: Modeler.ElementVariantMenu,
      id: 'activity-menu',
      props: {
        controller,
        elementId: 'activity-1',
        anchor: { x: 20, y: 20 },
        visible: true,
      },
    })
    app.raph.run()
    const activityChoiceIcons = surface
      .compileRenderFrame()
      .items
      .map(item => item.schemaItem)
      .filter(item => item?.type === 'icon' && Number(item.y) < 270)
    expect(activityChoiceIcons).toHaveLength(6)
    app.destroy()
    controller.unmount()
  })

  it('keeps independent scroll positions for multiple lists inside one variant menu', () => {
    const rect = createBasicRectElement({ id: 'rect-variant-scroll', x: 80, y: 80 })
    const controller = createModelerController({
      model: createModelerModel({
        elements: [rect],
        selection: [rect.id],
      }),
    })
    controller.mount(createControllerHost(640, 760))
    const context = controller.getPluginContext()
    const optionsA = Array.from({ length: 10 }, (_, index) => ({ id: `a-${index}`, title: `A${index}` }))
    const optionsB = Array.from({ length: 10 }, (_, index) => ({ id: `b-${index}`, title: `B${index}` }))
    const dispose = context.elementVariants.register({
      id: 'test.two-list.variants',
      matches: (_context, element) => element.id === rect.id,
      getDescriptor: () => ({
        title: 'Two lists',
        controls: [
          { id: 'first', kind: 'list', title: 'First', value: 'a-0', options: optionsA },
          { id: 'second', kind: 'list', title: 'Second', value: 'b-0', options: optionsB },
        ],
      }),
      apply: () => {},
    })

    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 520, height: 760, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('two-list-variant-menu')
    app.schema.createNode(surface, {
      type: Modeler.ElementVariantMenu,
      id: 'two-list-variant-menu',
      props: {
        controller,
        elementId: rect.id,
        anchor: { x: 20, y: 20 },
        visible: true,
      },
    })
    app.raph.run()

    const texts = (): Array<string> => surface
      .compileRenderFrame()
      .items
      .map(item => item.schemaItem)
      .filter(item => item?.type === 'text')
      .map(item => String(item?.text))

    expect(texts()).toEqual(expect.arrayContaining(['A0', 'B0']))
    const wheel = new WheelEvent('wheel', { clientX: 80, clientY: 410, deltaY: 132 })
    Object.defineProperties(wheel, {
      offsetX: { value: 80 },
      offsetY: { value: 410 },
    })
    app.handleEvent('wheel', wheel)
    app.raph.run()

    const after = texts()
    expect(after).toContain('A0')
    expect(after).not.toContain('B0')
    expect(after).toContain('B3')
    app.destroy()
    dispose()
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

  it('publishes BPMN artifact and data elements as base palette blocks', () => {
    const textAnnotation = createBpmnTextAnnotationElement({
      id: 'annotation-1',
      text: '',
      bracketSide: 'broken' as never,
    })
    const group = createBpmnGroupElement({ id: 'group-1', name: '' })
    const dataObject = createBpmnDataObjectElement({
      id: 'data-object-1',
      width: 222,
      height: 333,
      dataObjectType: 'broken' as never,
      isCollection: true,
    })
    const dataStore = createBpmnDataStoreElement({ id: 'data-store-1', name: '', width: 222, height: 333 })
    const association = createBpmnAssociationElement({
      id: 'association-1',
      associationType: 'broken' as never,
      source: { elementId: 'source', point: { x: 0, y: 0 } },
      target: { elementId: 'target', point: { x: 100, y: 0 } },
    })

    expect(textAnnotation).toMatchObject({
      type: 'bpmn.textAnnotation',
      width: 160,
      height: 80,
      data: { text: 'Text annotation', bracketSide: 'left' },
    })
    expect(group).toMatchObject({
      type: 'bpmn.group',
      width: 240,
      height: 160,
      data: { name: 'Group' },
    })
    expect(dataObject).toMatchObject({
      type: 'bpmn.dataObject',
      width: 96,
      height: 120,
      data: {
        name: 'Data object',
        dataObjectType: 'object',
        isCollection: true,
      },
    })
    expect(dataStore).toMatchObject({
      type: 'bpmn.dataStore',
      width: 120,
      height: 96,
      data: { name: 'Data store' },
    })
    expect(association).toMatchObject({
      type: 'bpmn.association',
      data: { associationType: 'undirected' },
    })

    const controller = createModelerController({
      model: createModelerModel({
        elements: [textAnnotation, group, dataObject, dataStore, association],
        selection: [dataObject.id],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()

    expect(context.palette.get('bpmn.text-annotation.create')).toMatchObject({
      kind: 'tool',
      icon: 'bpmn-text-annotation',
      toolId: 'create:bpmn.text-annotation',
    })
    expect(context.palette.get('bpmn.group.create')).toMatchObject({
      kind: 'tool',
      icon: 'bpmn-group',
      toolId: 'create:bpmn.group',
    })
    expect(context.palette.get('bpmn.data.create')).toMatchObject({
      kind: 'tool',
      icon: 'bpmn-data-object',
      toolId: 'create:bpmn.data',
    })
    expect(context.palette.get('bpmn.association.create')).toMatchObject({
      kind: 'tool',
      group: 'tools',
      icon: 'bpmn-association',
      toolId: 'connect:bpmn.association',
    })
    expect(context.tools.get('create:bpmn.association')).toBeUndefined()
    expect(context.tools.get('connect:bpmn.association')).toMatchObject({
      kind: 'mode',
      title: 'Association',
    })
    expect(context.palette.get('bpmn.data-object.create')).toBeUndefined()
    expect(context.palette.get('bpmn.data-store.create')).toBeUndefined()
    expect(context.palette.get('bpmn.data-object.input.create')).toBeUndefined()
    expect(context.palette.get('bpmn.text-annotation.right.create')).toBeUndefined()

    expect(context.elementVariants.getProvider(textAnnotation)?.id).toBe('bpmn.textAnnotation.variants')
    expect(context.elementVariants.getProvider(dataObject)?.id).toBe('bpmn.data.variants')
    expect(context.elementVariants.getProvider(dataStore)?.id).toBe('bpmn.data.variants')
    expect(context.elementVariants.getProvider(association)?.id).toBe('bpmn.association.variants')
    expect(controller.getElementRegistry().require('bpmn.association').capabilities?.colorable).toMatchObject({
      fill: false,
      stroke: true,
      custom: true,
    })
    expect(controller.getElementRegistry().require('bpmn.dataObject').capabilities?.resizable).toBe(false)
    expect(controller.getElementRegistry().require('bpmn.dataStore').capabilities?.resizable).toBe(false)
    expect(controller.getElementRegistry().require('bpmn.dataObject').getPorts?.(context, dataObject).map(port => port.id)).toEqual(['top', 'right', 'bottom', 'left'])

    controller.applyCommand({ type: 'element.resize', id: dataObject.id, bounds: { width: 300, height: 300 } })
    expect(controller.getModel().elements.find(element => element.id === dataObject.id)).toMatchObject({
      width: 96,
      height: 120,
    })
    controller.unmount()
  })

  it('publishes BPMN swimlane as one palette block with lane geometry and variants', () => {
    const participant = createBpmnParticipantElement({ id: 'pool-1', x: 80, y: 80 })
    const withSecondLane = addBpmnParticipantLane(participant)
    expect(participant).toMatchObject({
      type: 'bpmn.participant',
      width: 520,
      height: 260,
      data: {
        name: 'Participant',
        orientation: 'horizontal',
      },
    })
    expect(participant.data.lanes).toHaveLength(1)
    expect(withSecondLane.data.lanes.map(lane => lane.name)).toEqual(['Lane 1', 'Lane 2'])

    const controller = createModelerController({
      model: createModelerModel({
        elements: [withSecondLane],
        selection: ['pool-1'],
      }),
    })
    controller.mount(createControllerHost(800, 520))
    const context = controller.getPluginContext()
    const provider = context.elementVariants.getProvider(withSecondLane)

    expect(context.palette.get('bpmn.swimlane.create')).toMatchObject({
      kind: 'tool',
      icon: 'bpmn-swimlane',
      toolId: 'create:bpmn.swimlane',
    })
    expect(provider?.id).toBe('bpmn.swimlane.variants')
    const draft = provider?.createDraft?.(context, withSecondLane) ?? {}
    const descriptor = provider?.getDescriptor(context, withSecondLane, draft)
    const orientationControl = descriptor?.controls.find(control => control.id === 'orientation')
    expect(orientationControl?.kind).toBe('choice')
    expect(orientationControl?.options.map(option => option.id)).toEqual(['horizontal', 'vertical'])
    expect(orientationControl?.options.every(option => Boolean(option.icon))).toBe(true)

    expect(controller.hitTest(controller.worldToScreen({ x: 90, y: 120 }))).toEqual({
      type: 'element-part',
      id: 'pool-1',
      partType: 'bpmn.swimlane.participant',
      partId: 'participant',
    })
    expect(controller.hitTest(controller.worldToScreen({ x: 125, y: 120 }))).toEqual({
      type: 'element-part',
      id: 'pool-1',
      partType: 'bpmn.swimlane.lane',
      partId: withSecondLane.data.lanes[0]?.id,
    })
    expect(controller.hitTest(controller.worldToScreen({ x: 260, y: 120 }))).toEqual({ type: 'element', id: 'pool-1' })

    provider?.apply({
      context,
      element: withSecondLane,
      draft,
      control: orientationControl!,
      option: orientationControl!.options[1]!,
    })
    expect(controller.getModel().elements[0]).toMatchObject({
      id: 'pool-1',
      type: 'bpmn.participant',
      data: { orientation: 'vertical' },
    })
    expect(controller.getModel().selection).toEqual(['pool-1'])
    controller.applyCommand({
      type: 'element.resize',
      id: 'pool-1',
      bounds: { width: 80, height: 80 },
    })
    expect(controller.getModel().elements[0]?.width).toBeGreaterThanOrEqual(128)
    expect(controller.getModel().elements[0]?.height).toBeGreaterThanOrEqual(248)
    expect(context.tools.createAt('create:bpmn.swimlane', { x: 720, y: 420 })?.type).toBe('bpmn.participant')
    controller.unmount()
  })

  it('keeps BPMN participant behind enclosed nodes at the same z-index', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const participant = createBpmnParticipantElement({ id: 'pool-1', x: 80, y: 80, width: 520, height: 260 })
    const task = createBpmnTaskElement({ id: 'task-inside-pool', x: 240, y: 120, name: 'Inside pool' })
    const controller = createModelerController({
      model: createModelerModel({
        elements: [task, participant],
      }),
    })
    controller.mount(createControllerHost(800, 520))
    expect(controller.hitTest(controller.worldToScreen({ x: 260, y: 140 }))).toEqual({
      type: 'element',
      id: 'task-inside-pool',
    })
    controller.unmount()

    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 800, height: 520, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'swimlane-order-root',
      props: {
        model: createModelerModel({
          elements: [task, participant],
        }),
        width: 800,
        height: 520,
      },
    })
    app.raph.run()
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'swimlane-order-root:interaction')
    const childIds = interaction?.children.map(child => (child as { componentId?: string }).componentId) ?? []
    expect(childIds.indexOf('pool-1:view')).toBeGreaterThanOrEqual(0)
    expect(childIds.indexOf('task-inside-pool:view')).toBeGreaterThan(childIds.indexOf('pool-1:view'))
    app.destroy()
  })

  it('renders BPMN participant geometry in viewport scale', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const participant = createBpmnParticipantElement({
      id: 'pool-scaled',
      x: 80,
      y: 80,
      width: 520,
      height: 260,
      lanes: [
        { id: 'lane-a', name: 'A', size: 130 },
        { id: 'lane-b', name: 'B', size: 130 },
      ],
    })
    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 800, height: 520, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'swimlane-scaled-root',
      props: {
        model: createModelerModel({
          viewport: { x: 0, y: 0, scale: 0.1 },
          elements: [participant],
        }),
        width: 800,
        height: 520,
      },
    })
    app.raph.run()
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'swimlane-scaled-root:interaction')
    const schemaItems = interaction?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(schemaItems.some(item => item.type === 'rect' && item.width === 52 && item.height === 26)).toBe(true)
    expect(schemaItems.some(item => item.type === 'rect' && item.width === 520 && item.height === 260)).toBe(false)
    app.destroy()
  })

  it('updates BPMN participant geometry when viewport scale changes', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const participant = createBpmnParticipantElement({
      id: 'pool-dynamic-scale',
      x: 80,
      y: 80,
      width: 520,
      height: 260,
      lanes: [
        { id: 'lane-a', name: 'A', size: 130 },
        { id: 'lane-b', name: 'B', size: 130 },
      ],
    })
    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 800, height: 520, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'swimlane-dynamic-scale-root',
      props: {
        model: createModelerModel({
          canvas: { x: -1000, y: -1000, width: 4000, height: 3000 },
          viewport: { x: 0, y: 0, scale: 1 },
          elements: [participant],
        }),
        width: 800,
        height: 520,
      },
    }) as Root
    app.raph.run()

    root.getApi().setViewport({ scale: 0.1 })
    app.raph.run()
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'swimlane-dynamic-scale-root:interaction')
    const schemaItems = interaction?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(schemaItems.some(item => item.type === 'rect' && item.width === 52 && item.height === 26)).toBe(true)
    expect(schemaItems.some(item => item.type === 'rect' && item.width === 520 && item.height === 260)).toBe(false)
    app.destroy()
  })

  it('uses the BPMN recipe layer for unselected nodes at low zoom', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const task = createBpmnTaskElement({ id: 'recipe-task', x: 120, y: 120, name: 'Recipe task' })
    const event = createBpmnEventElement({ id: 'recipe-event', x: 80, y: 136 })
    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'recipe-root',
      props: {
        model: createModelerModel({
          viewport: { x: 0, y: 0, scale: 0.1 },
          elements: [event, task],
        }),
        width: 640,
        height: 420,
      },
    })
    app.raph.run()
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'recipe-root:interaction')
    const childIds = interaction?.children.map(child => (child as { componentId?: string }).componentId) ?? []
    expect(childIds).toContain('modeler-elements:bpmn-recipe-layer')
    expect(childIds).not.toContain('recipe-task:view')
    const frameItems = interaction?.compileRenderFrame().items ?? []
    expect(frameItems.some(item => item.kind === 'rect-batch')).toBe(true)
    expect(frameItems.some(item => item.kind === 'text-batch')).toBe(true)
    app.destroy()
  })

  it('keeps selected BPMN nodes on the precise view path while recipe rendering is active', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const selectedTask = createBpmnTaskElement({ id: 'selected-recipe-task', x: 120, y: 120, name: 'Selected' })
    const event = createBpmnEventElement({ id: 'unselected-recipe-event', x: 80, y: 136 })
    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'recipe-selected-root',
      props: {
        model: createModelerModel({
          viewport: { x: 0, y: 0, scale: 0.1 },
          elements: [event, selectedTask],
          selection: [selectedTask.id],
        }),
        width: 640,
        height: 420,
      },
    })
    app.raph.run()
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'recipe-selected-root:interaction')
    const childIds = interaction?.children.map(child => (child as { componentId?: string }).componentId) ?? []
    expect(childIds).toContain('modeler-elements:bpmn-recipe-layer')
    expect(childIds).toContain('selected-recipe-task:view')
    expect(childIds).not.toContain('unselected-recipe-event:view')
    app.destroy()
  })

  it('can disable BPMN recipe rendering through modeler options', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const task = createBpmnTaskElement({ id: 'recipe-disabled-task', x: 120, y: 120 })
    const app = Nova.createApp({
      target: document.createElement('canvas'),
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'recipe-disabled-root',
      props: {
        model: createModelerModel({
          viewport: { x: 0, y: 0, scale: 0.1 },
          elements: [task],
        }),
        options: {
          rendering: {
            bpmnRecipes: { enabled: false },
          },
        },
        width: 640,
        height: 420,
      },
    })
    app.raph.run()
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'recipe-disabled-root:interaction')
    const childIds = interaction?.children.map(child => (child as { componentId?: string }).componentId) ?? []
    expect(childIds).not.toContain('modeler-elements:bpmn-recipe-layer')
    expect(childIds).toContain('recipe-disabled-task:view')
    app.destroy()
  })

  it('switches BPMN data object and data store through one variant provider', () => {
    const dataObject = createBpmnDataObjectElement({
      id: 'data-1',
      x: 120,
      y: 140,
      name: 'Customer payload',
      style: { fill: '#ffffff', stroke: '#1f2937' },
    })
    const controller = createModelerController({
      model: createModelerModel({
        elements: [dataObject],
        selection: [dataObject.id],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()
    const provider = context.elementVariants.getProvider(dataObject)
    expect(provider?.id).toBe('bpmn.data.variants')

    let current = controller.getModel().elements[0]!
    let draft = provider?.createDraft?.(context, current) ?? {}
    let descriptor = provider?.getDescriptor(context, current, draft)
    let dataKindControl = descriptor?.controls.find(control => control.id === 'dataKind')
    expect(dataKindControl?.options.map(option => option.id)).toEqual(['object', 'input', 'output', 'store'])
    expect(descriptor?.headerControls?.map(control => control.id)).toEqual(['isCollection'])

    provider?.apply({
      context,
      element: current,
      draft,
      control: dataKindControl!,
      option: dataKindControl!.options.find(option => option.id === 'input')!,
    })
    current = controller.getModel().elements[0]!
    expect(current).toMatchObject({
      id: 'data-1',
      type: 'bpmn.dataObject',
      x: 120,
      y: 140,
      data: {
        name: 'Customer payload',
        dataObjectType: 'input',
      },
      style: { fill: '#ffffff', stroke: '#1f2937' },
    })

    draft = provider?.createDraft?.(context, current) ?? {}
    descriptor = provider?.getDescriptor(context, current, draft)
    const collectionControl = descriptor?.headerControls?.find(control => control.id === 'isCollection')
    provider?.apply({
      context,
      element: current,
      draft,
      control: collectionControl!,
      option: collectionControl!.options[0]!,
    })
    expect(controller.getModel().elements[0]?.data?.isCollection).toBe(true)

    current = controller.getModel().elements[0]!
    draft = provider?.createDraft?.(context, current) ?? {}
    descriptor = provider?.getDescriptor(context, current, draft)
    dataKindControl = descriptor?.controls.find(control => control.id === 'dataKind')
    provider?.apply({
      context,
      element: current,
      draft,
      control: dataKindControl!,
      option: dataKindControl!.options.find(option => option.id === 'store')!,
    })
    current = controller.getModel().elements[0]!
    expect(current).toMatchObject({
      id: 'data-1',
      type: 'bpmn.dataStore',
      x: 120,
      y: 140,
      width: 120,
      height: 96,
      data: { name: 'Customer payload' },
      style: { fill: '#ffffff', stroke: '#1f2937' },
    })
    expect(controller.getModel().selection).toEqual(['data-1'])
    expect(context.elementVariants.getProvider(current)?.id).toBe('bpmn.data.variants')
    expect(context.elementVariants.getProvider(current)?.getDescriptor(context, current, provider?.createDraft?.(context, current) ?? {}).headerControls).toEqual([])

    const storeProvider = context.elementVariants.getProvider(current)
    draft = storeProvider?.createDraft?.(context, current) ?? {}
    descriptor = storeProvider?.getDescriptor(context, current, draft)
    dataKindControl = descriptor?.controls.find(control => control.id === 'dataKind')
    storeProvider?.apply({
      context,
      element: current,
      draft,
      control: dataKindControl!,
      option: dataKindControl!.options.find(option => option.id === 'output')!,
    })
    expect(controller.getModel().elements[0]).toMatchObject({
      id: 'data-1',
      type: 'bpmn.dataObject',
      width: 96,
      height: 120,
      data: {
        name: 'Customer payload',
        dataObjectType: 'output',
        isCollection: false,
      },
    })
    controller.unmount()
  })

  it('creates and switches BPMN data associations through context actions and variants', () => {
    const dataObject = createBpmnDataObjectElement({ id: 'data-object-1', x: 80, y: 120 })
    const dataStore = createBpmnDataStoreElement({ id: 'data-store-1', x: 80, y: 260 })
    const task = createBpmnTaskElement({ id: 'task-1', x: 260, y: 128 })
    const association = createBpmnDataAssociationElement({
      id: 'data-association-1',
      dataAssociationType: 'broken' as never,
      source: { elementId: dataObject.id, point: { x: 176, y: 180 } },
      target: { elementId: task.id, point: { x: 260, y: 168 } },
      waypoints: [{ x: 216, y: 180 }],
    })
    expect(association).toMatchObject({
      type: 'bpmn.dataAssociation',
      data: {
        associationType: 'directed',
        dataAssociationType: 'input',
      },
    })

    const controller = createModelerController({
      model: createModelerModel({
        elements: [dataObject, dataStore, task, association],
        selection: [association.id],
      }),
    })
    controller.mount(createControllerHost(720, 480))
    const context = controller.getPluginContext()

    expect(context.palette.get('bpmn.dataAssociation.create')).toBeUndefined()
    expect(context.tools.get('connect:bpmn.dataAssociation')).toMatchObject({
      kind: 'mode',
      title: 'Data association',
    })
    expect(context.actions.get('element.connect.data-association.from-selection')).toBeTruthy()
    expect(context.elementVariants.getProvider(association)?.id).toBe('bpmn.dataAssociation.variants')
    expect(controller.getElementRegistry().require('bpmn.dataAssociation').capabilities?.colorable).toMatchObject({
      fill: false,
      stroke: true,
      custom: true,
    })

    const provider = context.elementVariants.getProvider(association)!
    const descriptor = provider.getDescriptor(context, association, provider.createDraft?.(context, association) ?? {})
    const typeControl = descriptor.controls.find(control => control.id === 'dataAssociationType')!
    expect(typeControl.options.map(option => option.id)).toEqual(['input', 'output'])
    provider.apply({
      context,
      element: association,
      draft: provider.createDraft?.(context, association) ?? {},
      control: typeControl,
      option: typeControl.options.find(option => option.id === 'output')!,
    })
    expect(controller.getModel().elements.find(element => element.id === association.id)).toMatchObject({
      type: 'bpmn.dataAssociation',
      source: { elementId: task.id },
      target: { elementId: dataObject.id },
      waypoints: [{ x: 216, y: 180 }],
      data: { dataAssociationType: 'output' },
    })
    expect(controller.getModel().selection).toEqual([association.id])

    controller.applyCommand({ type: 'select', ids: [dataStore.id] })
    expect(context.actions.run('element.connect.data-association.from-selection')).toBe(true)
    expect(context.tools.getActiveId()).toBe('connect:bpmn.dataAssociation')
    const inputCreated = MODEL_ELEMENTS_RUNTIME.connectionFlow.completeAtTarget(
      context,
      { type: 'element', id: task.id },
      { x: task.x, y: task.y + task.height / 2 },
    )
    expect(inputCreated).toMatchObject({
      type: 'bpmn.dataAssociation',
      source: { elementId: dataStore.id },
      target: { elementId: task.id },
      data: { dataAssociationType: 'input' },
    })

    controller.applyCommand({ type: 'select', ids: [task.id] })
    expect(context.actions.run('element.connect.data-association.from-selection')).toBe(true)
    const outputCreated = MODEL_ELEMENTS_RUNTIME.connectionFlow.completeAtTarget(
      context,
      { type: 'element', id: dataStore.id },
      { x: dataStore.x, y: dataStore.y + dataStore.height / 2 },
    )
    expect(outputCreated).toMatchObject({
      type: 'bpmn.dataAssociation',
      source: { elementId: task.id },
      target: { elementId: dataStore.id },
      data: { dataAssociationType: 'output' },
    })
    MODEL_ELEMENTS_RUNTIME.connectionFlow.clear()
    controller.unmount()
  })

  it('creates BPMN message flows only across participants and manages message refs', () => {
    const poolA = createBpmnParticipantElement({ id: 'pool-a', x: 80, y: 80, name: 'Pool A' })
    const poolB = createBpmnParticipantElement({ id: 'pool-b', x: 80, y: 380, name: 'Pool B' })
    const sourceTask = createBpmnTaskElement({ id: 'source-task', x: 240, y: 120, name: 'Source' })
    const targetTask = createBpmnTaskElement({ id: 'target-task', x: 240, y: 420, name: 'Target' })
    const samePoolTask = createBpmnTaskElement({ id: 'same-pool-task', x: 380, y: 120, name: 'Same pool' })
    const messageFlow = createBpmnMessageFlowElement({
      id: 'message-flow-1',
      source: { elementId: sourceTask.id, point: { x: 340, y: 160 } },
      target: { elementId: targetTask.id, point: { x: 240, y: 460 } },
      messageRef: 'customer-message',
    })
    expect(messageFlow).toMatchObject({
      type: 'bpmn.messageFlow',
      data: { messageRef: 'customer-message' },
    })

    const elements = [poolA, poolB, sourceTask, targetTask, samePoolTask, messageFlow]
    expect(canConnectBpmnMessageFlow(elements, sourceTask, targetTask)).toBe(true)
    expect(canConnectBpmnMessageFlow(elements, sourceTask, samePoolTask)).toBe(false)
    expect(canConnectBpmnMessageFlow(elements, sourceTask, createBpmnTaskElement({ id: 'outside', x: 20, y: 20 }))).toBe(false)

    const controller = createModelerController({
      model: createModelerModel({
        bpmnDefinitions: [{ id: 'customer-message', kind: 'message', name: 'Customer message' }],
        elements,
        selection: [messageFlow.id],
      }),
    })
    controller.mount(createControllerHost(800, 760))
    const context = controller.getPluginContext()

    expect(context.palette.get('bpmn.message-flow.create')).toMatchObject({
      kind: 'tool',
      icon: 'bpmn-message-flow',
      toolId: 'connect:bpmn.messageFlow',
    })
    expect(context.tools.get('connect:bpmn.messageFlow')).toMatchObject({
      kind: 'mode',
      title: 'Message flow',
    })
    expect(context.actions.get('element.connect.message-flow.from-selection')).toBeTruthy()
    expect(context.elementVariants.getProvider(messageFlow)?.id).toBe('bpmn.messageFlow.variants')
    expect(controller.getElementRegistry().require('bpmn.messageFlow').capabilities?.colorable).toMatchObject({
      fill: false,
      stroke: true,
      custom: true,
    })

    const provider = context.elementVariants.getProvider(messageFlow)!
    const descriptor = provider.getDescriptor(context, messageFlow, provider.createDraft?.(context, messageFlow) ?? {})
    expect(descriptor.controls.map(control => control.id)).toEqual(['messageRef', 'definitionName'])
    const nameControl = descriptor.controls.find(control => control.id === 'definitionName')!
    provider.apply({
      context,
      element: messageFlow,
      draft: provider.createDraft?.(context, messageFlow) ?? {},
      control: nameControl,
      option: {
        id: 'definitionName:input',
        title: 'Renamed message',
        data: { definitionName: 'Renamed message' },
      },
    })
    expect(controller.getModel().bpmnDefinitions.find(definition => definition.id === 'customer-message')).toMatchObject({
      name: 'Renamed message',
    })

    controller.applyCommand({ type: 'select', ids: [sourceTask.id] })
    expect(context.actions.run('element.connect.message-flow.from-selection')).toBe(true)
    expect(context.tools.getActiveId()).toBe('connect:bpmn.messageFlow')
    const created = MODEL_ELEMENTS_RUNTIME.connectionFlow.completeAtTarget(
      context,
      { type: 'element', id: targetTask.id },
      { x: targetTask.x, y: targetTask.y + targetTask.height / 2 },
    )
    expect(created).toMatchObject({
      type: 'bpmn.messageFlow',
      source: { elementId: sourceTask.id },
      target: { elementId: targetTask.id },
    })

    controller.applyCommand({ type: 'select', ids: [sourceTask.id] })
    expect(context.actions.run('element.connect.message-flow.from-selection')).toBe(true)
    const samePoolCreated = MODEL_ELEMENTS_RUNTIME.connectionFlow.completeAtTarget(
      context,
      { type: 'element', id: samePoolTask.id },
      { x: samePoolTask.x, y: samePoolTask.y + samePoolTask.height / 2 },
    )
    expect(samePoolCreated).toBeNull()
    MODEL_ELEMENTS_RUNTIME.connectionFlow.clear()
    controller.unmount()
  })

  it('creates BPMN association from the palette action through the connection flow', () => {
    const start = createBpmnEventElement({ id: 'start-1', x: 100, y: 100 })
    const task = createBpmnTaskElement({ id: 'task-1', x: 220, y: 84 })
    const controller = createModelerController({
      model: createModelerModel({
        elements: [start, task],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()

    context.actions.run('element.create.bpmn.association')
    expect(context.tools.getActiveId()).toBe('connect:bpmn.association')
    expect(MODEL_ELEMENTS_RUNTIME.connectionFlow.beginFromElement(context, start.id, 'tool')).toBe(true)
    const created = MODEL_ELEMENTS_RUNTIME.connectionFlow.completeAtTarget(
      context,
      { type: 'element', id: task.id },
      { x: task.x, y: task.y + task.height / 2 },
    )

    expect(created).toMatchObject({
      type: 'bpmn.association',
      source: { elementId: start.id },
      target: { elementId: task.id },
    })
    const elements = controller.getModel().elements
    expect(elements[elements.length - 1]).toMatchObject({
      type: 'bpmn.association',
      source: { elementId: start.id },
      target: { elementId: task.id },
    })
    MODEL_ELEMENTS_RUNTIME.connectionFlow.clear()
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
    expect(createBpmnFlowElement({
      id: 'flow-without-ports',
      source: { elementId: start.id, point: { x: 148, y: 124 } },
      target: { elementId: task.id, point: { x: 220, y: 124 } },
    })).toMatchObject({
      source: { elementId: start.id, point: { x: 148, y: 124 } },
      target: { elementId: task.id, point: { x: 220, y: 124 } },
    })

    const controller = createModelerController({
      model: createModelerModel({
        elements: [start, task, flow],
        selection: [flow.id],
      }),
    })
    controller.mount(createControllerHost(640, 420))
    const context = controller.getPluginContext()
    expect(MODEL_ELEMENTS_RUNTIME.anchors.resolveElementAnchor(start, { x: 300, y: 124 })).toEqual({ x: 148, y: 124 })
    expect(MODEL_ELEMENTS_RUNTIME.anchors.resolveElementAnchor(task, { x: 100, y: 124 })).toEqual({ x: 220, y: 124 })
    expect(MODEL_ELEMENTS_RUNTIME.anchors.resolveElementAnchor(createBpmnGatewayElement({ id: 'gateway-anchor', x: 300, y: 100 }), { x: 328, y: 220 })).toEqual({ x: 328, y: 156 })
    const current = controller.getModel().elements.find(element => element.id === flow.id)!
    const provider = context.elementVariants.getProvider(current)
    expect(provider?.id).toBe('bpmn.flow.variants')
    const descriptor = provider?.getDescriptor(context, current, provider.createDraft?.(context, current) ?? {})
    const familyControl = descriptor?.controls.find(control => control.id === 'connectionFamily')
    expect(familyControl?.options.map(option => option.id)).toEqual(['flow', 'association'])
    const typeControl = descriptor?.controls.find(control => control.id === 'flowType')
    expect(typeControl?.options.map(option => option.id)).toEqual(['sequence', 'conditionalSequence', 'defaultSequence'])
    expect(descriptor?.controls.find(control => control.id === 'name')).toMatchObject({
      kind: 'input',
      title: 'Label',
    })

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
    let currentFlow = controller.getModel().elements.find(element => element.id === flow.id)!
    provider?.apply({
      context,
      element: currentFlow,
      draft: provider.createDraft?.(context, currentFlow) ?? {},
      control: typeControl!,
      option: typeControl!.options.find(option => option.id === 'conditionalSequence')!,
    })
    currentFlow = controller.getModel().elements.find(element => element.id === flow.id)!
    let conditionalDescriptor = provider?.getDescriptor(context, currentFlow, provider.createDraft?.(context, currentFlow) ?? {})
    expect(conditionalDescriptor?.controls.find(control => control.id === 'conditionExpression')).toMatchObject({
      kind: 'input',
      title: 'Condition expression',
    })
    const labelControl = conditionalDescriptor!.controls.find(control => control.id === 'name')!
    provider?.apply({
      context,
      element: currentFlow,
      draft: provider.createDraft?.(context, currentFlow) ?? {},
      control: labelControl,
      option: { id: 'name:input', title: 'Approved path', data: { name: 'Approved path' } },
    })
    currentFlow = controller.getModel().elements.find(element => element.id === flow.id)!
    const conditionControl = conditionalDescriptor!.controls.find(control => control.id === 'conditionExpression')!
    provider?.apply({
      context,
      element: currentFlow,
      draft: provider.createDraft?.(context, currentFlow) ?? {},
      control: conditionControl,
      option: { id: 'conditionExpression:input', title: '${ approved }', data: { conditionExpression: '${ approved }' } },
    })
    expect(controller.getModel().elements.find(element => element.id === flow.id)).toMatchObject({
      data: {
        name: 'Approved path',
        conditionExpression: '${ approved }',
      },
    })

    const siblingDefault = createBpmnFlowElement({
      id: 'flow-default-sibling',
      flowType: 'defaultSequence',
      source: { elementId: start.id, point: { x: 148, y: 130 } },
      target: { elementId: task.id, point: { x: 220, y: 130 } },
    })
    controller.applyCommand({ type: 'element.add', element: siblingDefault })
    currentFlow = controller.getModel().elements.find(element => element.id === flow.id)!
    provider?.apply({
      context,
      element: currentFlow,
      draft: provider.createDraft?.(context, currentFlow) ?? {},
      control: typeControl!,
      option: typeControl!.options.find(option => option.id === 'defaultSequence')!,
    })
    expect(controller.getModel().elements.find(element => element.id === flow.id)?.data?.flowType).toBe('defaultSequence')
    expect(controller.getModel().elements.find(element => element.id === siblingDefault.id)?.data?.flowType).toBe('sequence')
    controller.applyCommand({ type: 'element.delete', id: siblingDefault.id })

    provider?.apply({
      context,
      element: controller.getModel().elements.find(element => element.id === flow.id)!,
      draft: provider.createDraft?.(context, current) ?? {},
      control: familyControl!,
      option: familyControl!.options.find(option => option.id === 'association')!,
    })
    let converted = controller.getModel().elements.find(element => element.id === flow.id)!
    expect(converted).toMatchObject({
      type: 'bpmn.association',
      source: { elementId: start.id },
      target: { elementId: task.id },
      waypoints: [{ x: 184, y: 124 }],
      data: { associationType: 'undirected' },
    })
    const associationProvider = context.elementVariants.getProvider(converted)!
    const associationDescriptor = associationProvider.getDescriptor(context, converted, associationProvider.createDraft?.(context, converted) ?? {})
    const associationControl = associationDescriptor.controls.find(control => control.id === 'associationType')!
    associationProvider.apply({
      context,
      element: converted,
      draft: associationProvider.createDraft?.(context, converted) ?? {},
      control: associationControl,
      option: associationControl.options.find(option => option.id === 'bidirectional')!,
    })
    expect(controller.getModel().elements.find(element => element.id === flow.id)).toMatchObject({
      type: 'bpmn.association',
      data: { associationType: 'bidirectional' },
    })
    const convertedFamilyControl = associationDescriptor.controls.find(control => control.id === 'connectionFamily')!
    const duplicateFlow = createBpmnFlowElement({
      id: 'flow-duplicate',
      source: { elementId: start.id, point: { x: 148, y: 124 } },
      target: { elementId: task.id, point: { x: 220, y: 124 } },
    })
    controller.applyCommand({ type: 'element.add', element: duplicateFlow })
    associationProvider.apply({
      context,
      element: controller.getModel().elements.find(element => element.id === flow.id)!,
      draft: associationProvider.createDraft?.(context, converted) ?? {},
      control: convertedFamilyControl,
      option: convertedFamilyControl.options.find(option => option.id === 'flow')!,
    })
    expect(controller.getModel().elements.find(element => element.id === flow.id)).toMatchObject({
      type: 'bpmn.association',
      data: { associationType: 'bidirectional' },
    })
    expect(controller.getModel().selection).toEqual([duplicateFlow.id])
    expect(MODEL_ELEMENTS_RUNTIME.connectionWarnings.get()).toMatchObject({
      title: 'Connection already exists',
      duplicateElementId: duplicateFlow.id,
    })
    controller.applyCommand({ type: 'element.delete', id: duplicateFlow.id })
    MODEL_ELEMENTS_RUNTIME.connectionWarnings.clear()
    associationProvider.apply({
      context,
      element: controller.getModel().elements.find(element => element.id === flow.id)!,
      draft: associationProvider.createDraft?.(context, converted) ?? {},
      control: convertedFamilyControl,
      option: convertedFamilyControl.options.find(option => option.id === 'flow')!,
    })
    converted = controller.getModel().elements.find(element => element.id === flow.id)!
    expect(converted).toMatchObject({
      type: 'bpmn.flow',
      source: { elementId: start.id },
      target: { elementId: task.id },
      waypoints: [{ x: 184, y: 124 }],
      data: { flowType: 'sequence' },
    })

    controller.applyCommand({ type: 'select', ids: [flow.id] })
    expect(controller.hitTest(controller.worldToScreen({ x: 184, y: 124 }))).toEqual({
      type: 'edge-waypoint-handle',
      elementId: flow.id,
      waypointIndex: 0,
    })
    controller.applyCommand({ type: 'select', ids: [] })
    expect(controller.hitTest(controller.worldToScreen({ x: 184, y: 124 }))).toEqual({ type: 'element', id: flow.id })
    expect(controller.hitTest(controller.worldToScreen({ x: 184, y: 160 }))).toEqual({ type: 'canvas' })
    controller.applyCommand({ type: 'element.patch', id: task.id, patch: { x: 260 } })
    expect(MODEL_ELEMENTS_RUNTIME.edges.createPath(context, controller.getModel().elements.find(element => element.id === flow.id)!)).toEqual([
      { x: 148, y: 124 },
      { x: 184, y: 124 },
      { x: 260, y: 124 },
    ])
    expect(MODEL_ELEMENTS_RUNTIME.routeOptimizer.optimizeWaypoints(
      context,
      controller.getModel().elements.find(element => element.id === flow.id)!,
      [{ x: 184, y: 124 }, { x: 202, y: 124 }],
    )).toEqual([])
    const path = context.getElementRegistry().require('bpmn.flow').hitTest?.(context, controller.getModel().elements.find(element => element.id === flow.id)!, { x: 260, y: 124 })
    expect(path).toBe(true)

    controller.applyCommand({ type: 'element.delete', id: start.id })
    expect(controller.getModel().elements.some(element => element.id === flow.id)).toBe(false)
    expect(controller.getModel().selection).toEqual([])
    controller.unmount()
  })

  it('validates structural BPMN graph rules', () => {
    const valid = createValidBpmnProcessElements()
    expect(BpmnValidationRuntime.validate(createModelerModel({ elements: valid })).status).toBe('valid')

    expect(validateBpmnRules([])).toEqual(expect.arrayContaining(['bpmn.noNodes', 'bpmn.noStartEvent', 'bpmn.noEndEvent']))
    expect(validateBpmnRules([createBasicRectElement({ id: 'rect-only' })])).toEqual(expect.arrayContaining(['bpmn.noNodes']))
    expect(validateBpmnRules(valid.filter(element => element.id !== 'start'))).toContain('bpmn.noStartEvent')
    expect(validateBpmnRules(valid.filter(element => element.id !== 'end'))).toContain('bpmn.noEndEvent')
    expect(validateBpmnRules([
      createBpmnEventElement({ id: 'start', eventPosition: 'start' }),
      createBpmnTaskElement({ id: 'task' }),
      createBpmnEventElement({ id: 'end', eventPosition: 'end' }),
    ])).toEqual(expect.arrayContaining(['bpmn.startNoOutgoing', 'bpmn.nodeNoIncoming', 'bpmn.nodeNoOutgoing', 'bpmn.endNoIncoming']))
    expect(validateBpmnRules([
      ...valid.slice(0, 3),
      createBpmnFlowElement({
        id: 'broken-flow',
        source: { elementId: 'missing', point: { x: 0, y: 0 } },
        target: { elementId: 'rect', point: { x: 0, y: 0 } },
      }),
      createBasicRectElement({ id: 'rect' }),
    ])).toEqual(expect.arrayContaining(['bpmn.invalidFlowSource', 'bpmn.invalidFlowTarget']))
    expect(validateBpmnRules([
      ...valid.slice(0, 3),
      createBpmnFlowElement({
        id: 'self-flow',
        source: { elementId: 'task', point: { x: 0, y: 0 } },
        target: { elementId: 'task', point: { x: 0, y: 0 } },
      }),
    ])).toContain('bpmn.flowToSelf')
    expect(validateBpmnRules([
      ...valid,
      createBpmnFlowElement({
        id: 'end-to-start',
        source: { elementId: 'end', point: { x: 0, y: 0 } },
        target: { elementId: 'start', point: { x: 0, y: 0 } },
      }),
    ])).toEqual(expect.arrayContaining(['bpmn.startIncoming', 'bpmn.endOutgoing']))
    expect(validateBpmnRules([
      ...valid,
      createBpmnFlowElement({
        id: 'default-1',
        flowType: 'defaultSequence',
        source: { elementId: 'task', point: { x: 0, y: 0 } },
        target: { elementId: 'end', point: { x: 0, y: 0 } },
      }),
      createBpmnFlowElement({
        id: 'default-2',
        flowType: 'defaultSequence',
        source: { elementId: 'task', point: { x: 0, y: 0 } },
        target: { elementId: 'end', point: { x: 0, y: 0 } },
      }),
      createBpmnFlowElement({
        id: 'start-default',
        flowType: 'defaultSequence',
        source: { elementId: 'start', point: { x: 0, y: 0 } },
        target: { elementId: 'task', point: { x: 0, y: 0 } },
      }),
      createBpmnFlowElement({
        id: 'start-conditional',
        flowType: 'conditionalSequence',
        source: { elementId: 'start', point: { x: 0, y: 0 } },
        target: { elementId: 'task', point: { x: 0, y: 0 } },
      }),
    ])).toEqual(expect.arrayContaining([
      'bpmn.multipleDefaultFlows',
      'bpmn.invalidDefaultFlowSource',
      'bpmn.invalidConditionalFlowSource',
      'bpmn.conditionalFlowNoCondition',
    ]))
    const nonReceiveInstantiateModel = createModelerModel({ elements: [
      createBpmnEventElement({ id: 'start', eventPosition: 'start' }),
      createBpmnTaskElement({ id: 'task', taskType: 'user' }),
      createBpmnEventElement({ id: 'end', eventPosition: 'end' }),
      createBpmnFlowElement({ id: 'flow-1', source: { elementId: 'start', point: { x: 0, y: 0 } }, target: { elementId: 'task', point: { x: 0, y: 0 } } }),
      createBpmnFlowElement({ id: 'flow-2', source: { elementId: 'task', point: { x: 0, y: 0 } }, target: { elementId: 'end', point: { x: 0, y: 0 } } }),
    ] })
    expect(BpmnValidationRuntime.validate({
      ...nonReceiveInstantiateModel,
      elements: nonReceiveInstantiateModel.elements.map(element => element.id === 'task'
        ? { ...element, data: { ...element.data, instantiate: true } }
        : element),
    }).issues.map(issue => issue.ruleId)).toContain('bpmn.instantiateNonReceiveTask')
  })

  it('publishes debounced BPMN validation results without reacting to viewport changes', () => {
    vi.useFakeTimers()
    const validate = vi.fn(model => createValidationResult(model.version, model.elements.length > 0 ? 'valid' : 'invalid'))
    const controller = createModelerController({
      model: createModelerModel(),
      pluginRuntime: createPluginRuntime().use(BpmnValidationPlugin.create({ debounceMs: 150, validate })),
    })
    controller.mount(createControllerHost(640, 420))

    expect(validate).toHaveBeenCalledTimes(1)
    expect(controller.getPluginContext().store.inject(BPMN_VALIDATION_RESULT_KEY)?.status).toBe('invalid')
    controller.setViewport({ x: 20 })
    vi.advanceTimersByTime(200)
    expect(validate).toHaveBeenCalledTimes(1)

    controller.applyCommand({ type: 'element.add', element: createBpmnEventElement({ id: 'start', eventPosition: 'start' }) })
    controller.applyCommand({ type: 'element.add', element: createBpmnEventElement({ id: 'end', eventPosition: 'end' }) })
    controller.applyCommand({ type: 'element.add', element: createBpmnTaskElement({ id: 'task' }) })
    expect(validate).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(149)
    expect(validate).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(validate).toHaveBeenCalledTimes(2)
    expect(controller.getPluginContext().store.inject(BPMN_VALIDATION_RESULT_KEY)?.status).toBe('valid')

    controller.applyCommand({ type: 'element.add', element: createBpmnTaskElement({ id: 'task-2' }) })
    controller.unmount()
    vi.advanceTimersByTime(200)
    expect(validate).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('renders BPMN validation badge states and reads cached controller validation result', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    expect(MODELER_ASSETS.icons.validationValid).toBeTruthy()
    expect(MODELER_ASSETS.icons.validationInvalid).toBeTruthy()
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 320, height: 120, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.BpmnValidationBadge,
      id: 'valid-badge',
      props: {
        result: createValidationResult(1, 'valid'),
      },
    })
    app.schema.createNode(surface, {
      type: Modeler.BpmnValidationBadge,
      id: 'invalid-badge',
      props: {
        result: createValidationResult(2, 'invalid'),
      },
    })
    app.raph.run()
    let items = surface.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean)
    expect(items.find(item => item.type === 'text' && item.text === 'Valid BPMN')).toBeTruthy()
    expect(items.find(item => item.type === 'text' && item.text === 'Invalid BPMN')).toBeTruthy()

    const controller = createModelerController({
      model: createModelerModel(),
      pluginRuntime: createPluginRuntime().use(BpmnValidationPlugin.create({
        validate: model => createValidationResult(model.version, 'invalid'),
      })),
    })
    controller.mount(createControllerHost(320, 120))
    app.schema.createNode(surface, {
      type: Modeler.BpmnValidationBadge,
      id: 'controller-badge',
      props: { controller },
    })
    app.raph.run()
    items = surface.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean)
    expect(items.filter(item => item.type === 'text' && item.text === 'Invalid BPMN')).toHaveLength(2)
    controller.unmount()
    app.destroy()
  })

  it('registers BPMN validation dialog and opens it from an invalid badge', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('validation-dialog')
    app.schema.createNode(surface, {
      type: NovaUIKit.Root,
      id: 'validation-root',
      props: {
        width: 640,
        height: 420,
      },
      children: [
        {
          type: Modeler.BpmnValidationDialog,
          id: 'validation-dialog',
        },
        {
          type: Modeler.BpmnValidationBadge,
          id: 'validation-badge',
          props: {
            result: createValidationResult(1, 'invalid'),
            rootId: 'validation-root',
          },
        },
      ],
    })
    app.raph.run()
    expect(app.components.get('validation-dialog')).toBeTruthy()
    expect(app.events.hitTest(20, 18)?.componentId).toBe('validation-badge')

    const rootApi = app.components.requireApi<{ getOpenDialogIds: () => Array<string> }>('validation-root')
    expect(rootApi.getOpenDialogIds()).toEqual([])
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 20, clientY: 18, button: 0 }))
    app.raph.run()
    app.raph.run()

    expect(rootApi.getOpenDialogIds()).toEqual(['modeler-bpmn-validation'])
    expect(app.components.requireApi<DialogApi>('nova-root-dialog-modeler-bpmn-validation').getProps()).toMatchObject({
      width: 760,
      height: 520,
      minWidth: 620,
      minHeight: 420,
    })
    const renderedItems = app.surfaces
      .flatMap(item => item.compileRenderFrame().items)
      .map(item => item.schemaItem)
      .filter(Boolean)
    expect(renderedItems.find(item => item.type === 'text' && item.text === 'BPMN validation')).toBeTruthy()
    expect(renderedItems.find(item => item.type === 'text' && item.text === '1 BPMN error found')).toBeTruthy()
    expect(renderedItems.find(item => item.type === 'text' && item.text === 'Invalid test model.')).toBeTruthy()
    expect(renderedItems.find(item => item.type === 'text' && String(item.text).includes('bpmn.noNodes'))).toBeTruthy()
    app.destroy()
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

  it('keeps the viewport center stable when zoom controls change scale', () => {
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
        model: createModelerModel({
          canvas: { x: -1000, y: -1000, width: 4000, height: 3000 },
          viewport: { x: -120, y: -80, scale: 1 },
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    const zoomControls = app.schema.createChild(root, {
      type: Modeler.ZoomControls,
      id: 'centered-zoom-controls',
      props: { minZoom: 0.1, maxZoom: 3, step: 0.2 },
    }) as { getApi(): { setValue(value: number): void } }
    app.raph.run()

    const center = { x: 320, y: 210 }
    const before = root.screenToWorld(center)
    zoomControls.getApi().setValue(2)
    app.raph.run()

    expect(root.getViewport().scale).toBe(2)
    expect(root.screenToWorld(center)).toEqual(before)
    app.destroy()
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
    expect(controller.hitTest({ x: 124, y: 95 })).toEqual({ type: 'canvas' })
  })

  it('renders BPMN event frames and catch/throw definition markers differently', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 520, height: 220, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'event-render-root',
      props: {
        model: createModelerModel({
          elements: [
            createBpmnEventElement({ id: 'start', x: 60, y: 80, eventPosition: 'start', trigger: 'none' }),
            createBpmnEventElement({ id: 'catch', x: 140, y: 80, eventPosition: 'intermediate', trigger: 'message', direction: 'catch' }),
            createBpmnEventElement({ id: 'throw', x: 220, y: 80, eventPosition: 'intermediate', trigger: 'signal', direction: 'throw' }),
            createBpmnEventElement({ id: 'end', x: 300, y: 80, eventPosition: 'end', trigger: 'terminate', direction: 'throw' }),
          ],
        }),
        width: 520,
        height: 220,
      },
    })
    app.raph.run()
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'event-render-root:interaction')
    const schemaItems = interaction?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(schemaItems.some(item => item.type === 'circle' && Number(item.styles?.border?.width) >= 3)).toBe(true)
    expect(schemaItems.filter(item => item.type === 'circle').length).toBeGreaterThanOrEqual(6)
    expect(schemaItems.some(item => item.type === 'rect' && item.styles?.background === 'rgba(0,0,0,0)')).toBe(true)
    expect(schemaItems.some(item => item.type === 'polygon')).toBe(true)
    expect(schemaItems.some(item => item.type === 'circle' && Number(item.radius) < 12)).toBe(true)
    app.destroy()
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
    app.theme.registerMany([
      {
        id: 'light',
        tokens: {
          '--modeler-palette-background': '#ffffff',
          '--modeler-mini-map-background': '#f8fafc',
        },
      },
      {
        id: 'dark',
        tokens: {
          '--modeler-palette-background': '#101827',
          '--modeler-mini-map-background': '#0f172a',
        },
      },
    ])
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
    app.theme.use('dark')
    app.raph.run()
    expect(app.theme.resolve('--modeler-palette-background')).toBe('#101827')
    expect(app.theme.resolve('--modeler-mini-map-background')).toBe('#0f172a')
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
    const root = app.schema.createNode(surface, {
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
              data: { name: 'Approved' },
            }),
          ],
          selection: ['rect-1', 'start-1', 'gateway-1', 'flow-1'],
        }),
        width: 640,
        height: 760,
      },
    }) as Root
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
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'start-1:port:top')).toBe(false)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'gateway-1:port:top')).toBe(false)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'flow-1:waypoint:0')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'flow-1:segment:0')).toBe(false)
    const flow = root.getModel().elements.find(element => element.id === 'flow-1')
    expect(flow && MODEL_ELEMENTS_RUNTIME.edges.isEdge(flow)).toBe(true)
    if (!flow || !MODEL_ELEMENTS_RUNTIME.edges.isEdge(flow)) throw new Error('Expected flow-1 edge element')
    const rootInternals = root as unknown as {
      controllerInstance: ReturnType<typeof createModelerController>
    }
    const context = rootInternals.controllerInstance.getPluginContext()
    const flowPath = MODEL_ELEMENTS_RUNTIME.edges.createPath(context, flow)
    const segmentHoverPoint = {
      x: (flowPath[0]!.x + flowPath[1]!.x) / 2,
      y: (flowPath[0]!.y + flowPath[1]!.y) / 2,
    }
    const segmentTarget = root.hitTest(segmentHoverPoint)
    expect(segmentTarget).toMatchObject({ type: 'edge-segment-handle', elementId: 'flow-1', segmentIndex: 0 })
    MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.set(
      MODEL_ELEMENTS_RUNTIME.edges.createSegmentHandleAtPoint(context, flow, segmentHoverPoint),
    )
    expect(MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.get()).toMatchObject({ elementId: 'flow-1', segmentIndex: 0 })
    app.raph.run()
    app.raph.run()
    const hoverInteraction = app.surfaces.find(item => item.name === 'elements-root:interaction')
    expect(hoverInteraction?.children.some(child => (child as { componentId?: string }).componentId === 'flow-1:segment:0')).toBe(true)
    const schemaItems = [
      ...(links?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []),
      ...(hoverInteraction?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []),
    ]
    expect(schemaItems.some(item => item.type === 'polygon')).toBe(true)
    expect(schemaItems.some(item => item.type === 'text' && item.text === 'Approved')).toBe(true)
    expect(schemaItems.some(item => item.type === 'circle' && item.styles?.background === '#2563eb')).toBe(true)
    app.destroy()
  })

  it('registers and renders BPMN task icons, markers and fixed hit areas without visual ports', () => {
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
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-fixed:port:top')).toBe(false)
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

  it('renders BPMN activity variants with BPMN markers, resize handles and editable wrapped labels', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      ...create2DContextStub(),
      measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    } as unknown as CanvasRenderingContext2D)
    const activityLayout = resolveBpmnActivityNameLayout({
      name: 'Collapsed activity with a long wrapped title',
      width: 160,
      height: 100,
    })
    expect(activityLayout.lines.length).toBeGreaterThan(1)

    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 860, height: 520, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'activity-render-root',
      props: {
        model: createModelerModel({
          elements: [
            createBpmnSubProcessElement({ id: 'sub-1', x: 60, y: 80, name: 'Sub-process' }),
            createBpmnSubProcessElement({ id: 'event-sub-1', x: 260, y: 80, name: 'Event sub-process', subProcessType: 'event' }),
            createBpmnSubProcessElement({ id: 'transaction-1', x: 460, y: 80, name: 'Transaction', subProcessType: 'transaction', style: { fill: '#eff6ff', stroke: '#1d4ed8' } }),
            createBpmnSubProcessElement({ id: 'ad-hoc-1', x: 60, y: 260, name: 'Ad-hoc sub-process', subProcessType: 'adHoc' }),
            createBpmnCallActivityElement({ id: 'call-1', x: 260, y: 260, name: 'Call activity', style: { fill: '#fefce8', stroke: '#854d0e' } }),
          ],
          selection: ['sub-1'],
        }),
        width: 860,
        height: 520,
      },
    }) as Root
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'activity-render-root:interaction')
    expect(interaction?.children.some(child => String((child as { componentId?: string }).componentId).includes('sub-1:resize:'))).toBe(true)
    expect(root.hitTest({ x: 140, y: 130 })).toEqual({ type: 'element', id: 'sub-1' })

    const schemaItems = interaction?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(schemaItems.some(item => item.type === 'text' && item.text === '~')).toBe(true)
    expect(schemaItems.some(item => item.type === 'rect' && item.styles?.border?.dashPattern?.join(',') === '6,4')).toBe(true)
    expect(schemaItems.some(item => item.type === 'rect' && item.x === -76 && item.y === -46)).toBe(true)
    expect(schemaItems.some(item => item.type === 'rect' && Number(item.styles?.border?.width) >= 3)).toBe(true)
    expect(schemaItems.some(item => item.type === 'line')).toBe(true)
    expect(schemaItems.some(item => item.type === 'rect' && item.styles?.background === '#eff6ff' && item.styles?.border?.color === '#1d4ed8')).toBe(true)
    expect(schemaItems.some(item => item.type === 'rect' && item.styles?.background === '#fefce8' && item.styles?.border?.color === '#854d0e')).toBe(true)

    ;(root as unknown as { openTaskNameEditorFromPoint(point: { x: number; y: number }): boolean })
      .openTaskNameEditorFromPoint({ x: 140, y: 130 })
    app.raph.run()
    const input = app.components.requireApi<InputApi>('activity-render-root:task-name-editor:input')
    input.setValue('Updated sub-process name')
    input.commit()
    app.raph.run()
    expect(root.getApi().getModel().elements.find(element => element.id === 'sub-1')?.data?.name).toBe('Updated sub-process name')
    app.destroy()
  })

  it('wraps BPMN task names and shows full-name tooltip only for clipped labels', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      ...create2DContextStub(),
      measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    } as unknown as CanvasRenderingContext2D)

    const wrappedLayout = resolveBpmnTaskNameLayout({
      name: 'Review invoice before payout',
      width: 120,
      height: 80,
    })
    expect(wrappedLayout.lines).toHaveLength(3)
    expect(wrappedLayout.clipped).toBe(false)
    expect(wrappedLayout.lines.at(-1)?.text).not.toMatch(/\.\.\.$/)

    const longName = 'Review customer application details before approval and archive history'
    const clippedLayout = resolveBpmnTaskNameLayout({
      name: longName,
      width: 120,
      height: 80,
    })
    expect(clippedLayout.lines.length).toBeGreaterThan(1)
    expect(clippedLayout.clipped).toBe(true)
    expect(clippedLayout.lines.at(-1)?.text).toMatch(/\.\.\.$/)

    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 520, height: 300, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'task-name-tooltip-root',
      props: {
        model: createModelerModel({
          elements: [
            createBpmnTaskElement({ id: 'task-short', x: 40, y: 80, name: 'Review invoice' }),
            createBpmnTaskElement({ id: 'task-long', x: 220, y: 80, name: longName }),
          ],
        }),
        width: 520,
        height: 300,
      },
    }) as Root
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'task-name-tooltip-root:interaction')
    const renderedTexts = interaction
      ?.compileRenderFrame().items
      .map(item => item.schemaItem)
      .filter(item => item?.type === 'text')
      .map(item => String(item?.text)) ?? []
    for (const line of clippedLayout.lines) expect(renderedTexts).toContain(line.text)

    expect(root.resolveNovaTooltipTarget({ x: 100, y: 120 })).toBeNull()
    const tooltip = root.resolveNovaTooltipTarget({ x: 280, y: 120 })
    expect(tooltip).toMatchObject({
      tooltip: { value: longName, placement: 'top', delay: 350 },
      targetId: 'task-long:name',
      targetType: 'modeler.bpmn.task.name',
    })
    app.destroy()
    getContextSpy.mockReturnValue(create2DContextStub())
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
    expect(pickInputProps(input.getProps())).toMatchObject({
      variant: 'ghost',
      align: 'center',
      wrap: true,
      resize: 'none',
      minRows: 1,
      maxRows: 3,
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
    app.components.requireApi<InputApi>(inputId).setValue('Committed outside\nwith notes')
    app.handleEvent('mousedown', offsetMouseEvent('mousedown', 560, 320))
    app.handleEvent('mouseup', offsetMouseEvent('mouseup', 560, 320))
    app.raph.run()
    expect(root.getApi().getModel().elements[0]?.data?.name).toBe('Committed outside\nwith notes')
    expect(app.components.get(inputId)).toBeFalsy()
    app.destroy()
  })

  it('edits BPMN sequence flow label inline from the label area', () => {
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
      id: 'flow-label-edit-root',
      props: {
        model: createModelerModel({
          elements: [
            createBpmnEventElement({ id: 'start-1', x: 100, y: 100 }),
            createBpmnTaskElement({ id: 'task-1', x: 220, y: 84 }),
            createBpmnFlowElement({
              id: 'flow-1',
              source: { elementId: 'start-1', point: { x: 148, y: 124 } },
              target: { elementId: 'task-1', point: { x: 220, y: 124 } },
              waypoints: [{ x: 184, y: 124 }],
              data: { name: 'Old label' },
            }),
          ],
          selection: ['flow-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    ;(root as unknown as { openTaskNameEditorFromPoint(point: { x: number; y: number }): boolean })
      .openTaskNameEditorFromPoint({ x: 184, y: 124 })
    app.raph.run()

    const inputId = 'flow-label-edit-root:task-name-editor:input'
    const input = app.components.requireApi<InputApi>(inputId)
    const links = app.surfaces.find(item => item.name === 'flow-label-edit-root:links')
    const linkTexts = () => links
      ?.compileRenderFrame().items
      .map(item => item.schemaItem)
      .filter(item => item?.type === 'text')
      .map(item => item?.text) ?? []
    expect(linkTexts()).not.toContain('Old label')
    expect(pickInputProps(input.getProps())).toMatchObject({
      variant: 'ghost',
      align: 'center',
      wrap: true,
      maxRows: 1,
      fontSize: 12,
      lineHeight: 16,
      border: { width: 0 },
      background: 'rgba(255,255,255,0)',
    })

    input.setValue('Approved path')
    input.commit()
    app.raph.run()
    expect(root.getApi().getModel().elements.find(element => element.id === 'flow-1')?.data?.name).toBe('Approved path')
    expect(linkTexts()).toContain('Approved path')
    expect(app.components.get(inputId)).toBeFalsy()
    app.destroy()
  })

  it('renders and edits BPMN data store label below the database icon', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createMeasured2DContextStub())
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
      id: 'data-store-name-edit-root',
      props: {
        model: createModelerModel({
          elements: [createBpmnDataStoreElement({
            id: 'data-store-1',
            x: 220,
            y: 100,
            name: 'Customer archive data store',
          })],
          selection: ['data-store-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const interaction = app.surfaces.find(item => item.name === 'data-store-name-edit-root:interaction')
    const schemaItems = interaction?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    const icon = schemaItems.find(item => item?.type === 'icon' && item.icon === MODELER_ASSETS.icons.database)
    const labels = schemaItems.filter(item => item?.type === 'text' && ['Customer', 'archive data', 'store'].includes(String(item.text)))
    expect(icon).toMatchObject({ type: 'icon' })
    expect(labels.map(item => item?.text)).toEqual(['Customer', 'archive data', 'store'])
    expect(Number(labels[0]?.y)).toBeGreaterThan(Number(icon?.y) + Number(icon?.height))
    expect(Number(labels[1]?.y)).toBeGreaterThan(Number(labels[0]?.y))

    app.handleEvent('mousedown', offsetMouseEvent('mousedown', 280, 170))
    app.handleEvent('mouseup', offsetMouseEvent('mouseup', 280, 170))
    app.handleEvent('mousedown', offsetMouseEvent('mousedown', 280, 170))
    app.handleEvent('mouseup', offsetMouseEvent('mouseup', 280, 170))
    app.raph.run()

    const inputId = 'data-store-name-edit-root:task-name-editor:input'
    const input = app.components.requireApi<InputApi>(inputId)
    expect(pickInputProps(input.getProps())).toMatchObject({
      variant: 'ghost',
      align: 'center',
      wrap: true,
      resize: 'none',
      minRows: 1,
      maxRows: 3,
      border: { width: 0 },
      background: 'rgba(255,255,255,0)',
    })
    const hiddenTexts = interaction
      ?.compileRenderFrame().items
      .map(item => item.schemaItem)
      .filter(item => item?.type === 'text')
      .map(item => item?.text) ?? []
    expect(hiddenTexts).not.toContain('Customer')
    expect(hiddenTexts).not.toContain('archive data')
    expect(hiddenTexts).not.toContain('store')

    input.setValue('Archive store\nwith notes')
    input.commit()
    app.raph.run()

    expect(root.getApi().getModel().elements[0]?.data?.name).toBe('Archive store\nwith notes')
    expect(app.components.get(inputId)).toBeFalsy()
    app.destroy()
  })

  it('edits BPMN group title from the header and shows clipped title tooltip', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createMeasured2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 640, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const title = 'Very long operations group title that does not fit'
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'group-title-edit-root',
      props: {
        model: createModelerModel({
          elements: [createBpmnGroupElement({ id: 'group-1', x: 180, y: 80, width: 240, height: 160, name: title })],
          selection: ['group-1'],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    const tooltip = root.resolveNovaTooltipTarget({ x: 202, y: 96 })
    expect(tooltip).toMatchObject({
      targetType: 'modeler.bpmn.group.name',
      tooltip: { value: title },
    })

    app.handleEvent('mousedown', offsetMouseEvent('mousedown', 202, 96))
    app.handleEvent('mouseup', offsetMouseEvent('mouseup', 202, 96))
    app.handleEvent('mousedown', offsetMouseEvent('mousedown', 202, 96))
    app.handleEvent('mouseup', offsetMouseEvent('mouseup', 202, 96))
    app.raph.run()

    const inputId = 'group-title-edit-root:task-name-editor:input'
    const input = app.components.requireApi<InputApi>(inputId)
    expect(pickInputProps(input.getProps())).toMatchObject({
      variant: 'ghost',
      align: 'left',
      wrap: true,
      resize: 'none',
      minRows: 1,
      maxRows: 1,
      border: { width: 0 },
      background: 'rgba(255,255,255,0)',
    })
    const interaction = app.surfaces.find(item => item.name === 'group-title-edit-root:interaction')
    const hiddenTexts = interaction
      ?.compileRenderFrame().items
      .map(item => item.schemaItem)
      .filter(item => item?.type === 'text')
      .map(item => item?.text) ?? []
    expect(hiddenTexts).not.toContain(title)

    input.setValue('Updated group')
    input.commit()
    app.raph.run()

    expect(root.getApi().getModel().elements[0]?.data?.name).toBe('Updated group')
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
      x: number
      y: number
      createLayoutPlan(options: unknown): {
        entries: Array<{
          type: string
          item?: { id: string }
          x: number
          y: number
          size?: number
        }>
      }
      resolvePaletteLayoutOptions(): unknown
      resolveNovaTooltipTarget(input: { x: number; y: number }): { tooltip?: unknown; rect?: { x: number; y: number; width: number; height: number } } | null
    }
    const resolveEntry = (id: string) => {
      const entry = palette
        .createLayoutPlan(palette.resolvePaletteLayoutOptions())
        .entries.find(item => item.type === 'item' && item.item?.id === id)
      if (!entry || typeof entry.size !== 'number') throw new Error(`Expected palette item ${id}`)
      return entry
    }
    const resolveTooltip = (id: string) => {
      const entry = resolveEntry(id)
      return palette.resolveNovaTooltipTarget({
        x: palette.x + entry.x + entry.size / 2,
        y: palette.y + entry.y + entry.size / 2,
      })
    }
    const connectEntry = resolveEntry('element.connect.tool')
    const associationEntry = resolveEntry('bpmn.association.create')
    const rectEntry = resolveEntry('basic.rect.create')
    const eventEntry = resolveEntry('bpmn.event.create')
    const connectTooltip = resolveTooltip('element.connect.tool')
    const messageFlowTooltip = resolveTooltip('bpmn.message-flow.create')
    const associationTooltip = resolveTooltip('bpmn.association.create')
    const rectTooltip = resolveTooltip('basic.rect.create')
    const rectTooltipFromEdge = palette.resolveNovaTooltipTarget({
      x: palette.x + rectEntry.x + rectEntry.size! - 4,
      y: palette.y + rectEntry.y + rectEntry.size! - 4,
    })
    const eventTooltip = resolveTooltip('bpmn.event.create')
    expect(connectTooltip?.tooltip).toMatchObject({ value: 'Connect elements', placement: 'cursor' })
    expect(connectTooltip?.rect).toMatchObject({ x: palette.x + connectEntry.x, y: palette.y + connectEntry.y, width: 40, height: 40 })
    expect(messageFlowTooltip?.tooltip).toMatchObject({ value: 'Connect message flow', placement: 'cursor' })
    expect(associationTooltip?.tooltip).toMatchObject({ value: 'Association', placement: 'cursor' })
    expect(associationTooltip?.rect).toMatchObject({ x: palette.x + associationEntry.x, y: palette.y + associationEntry.y, width: 40, height: 40 })
    expect(rectTooltip?.tooltip).toMatchObject({ value: 'Create Rectangle', placement: 'cursor' })
    expect(rectTooltip?.rect).toMatchObject({ x: palette.x + rectEntry.x, y: palette.y + rectEntry.y, width: 40, height: 40 })
    expect(rectTooltipFromEdge?.rect).toMatchObject({ x: palette.x + rectEntry.x, y: palette.y + rectEntry.y, width: 40, height: 40 })
    expect(eventTooltip?.tooltip).toMatchObject({ value: 'Create Event', placement: 'cursor' })
    expect(eventTooltip?.rect).toMatchObject({ x: palette.x + eventEntry.x, y: palette.y + eventEntry.y, width: 40, height: 40 })
    app.destroy()
  })

  it('applies initial root options to an external controller palette', () => {
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
      model: createModelerModel(),
      pluginRuntime: createPluginRuntime().use(MarqueeSelectionPlugin.create()),
    })
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'external-controller-palette-root',
      props: {
        model: createModelerModel(),
        controller,
        width: 640,
        height: 420,
        options: {
          branding: {
            visible: false,
          },
          palette: {
            visibleItemIds: ['marqueeSelection.tool', 'element.connect.tool', 'bpmn.message-flow.create'],
          },
        },
      },
    })
    app.raph.run()
    app.raph.run()

    expect(controller.getOptions().palette?.visibleItemIds).toEqual([
      'marqueeSelection.tool',
      'element.connect.tool',
      'bpmn.message-flow.create',
    ])
    expect(controller.getPluginContext().palette.getItems().map(item => item.id)).toEqual([
      'marqueeSelection.tool',
      'element.connect.tool',
      'bpmn.message-flow.create',
    ])
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
    expect(controls?.children.map(child => (child as { componentId?: string }).componentId)).toContain('partial-slots-root:download-controls')
    const brandItems = controls?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(app.components.get('partial-slots-root:bpmn-validation-badge')).toBeTruthy()
    expect(brandItems.find(item => item.type === 'text' && item.text === 'Valid BPMN')).toBeTruthy()
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
    expect(app.events.hitTest(24, 386)?.componentId).toBe('partial-slots-root:download-controls')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 24, clientY: 386, button: 0 }))
    app.raph.run()
    const openDownloadItems = controls?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(openDownloadItems.find(item => item.type === 'text' && item.text === 'Скачать BPMN')).toBeTruthy()
    expect(openDownloadItems.find(item => item.type === 'text' && item.text === 'Скачать PNG')).toBeTruthy()
    expect(openDownloadItems.filter(item => item.type === 'icon' && item.width === 16 && item.height === 16)).toHaveLength(2)
    expect(app.events.hitTest(606, 34)?.componentId).toBe('partial-slots-root:download-controls')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 606, clientY: 34, button: 0 }))
    app.raph.run()
    const closedDownloadItems = controls?.compileRenderFrame().items.map(item => item.schemaItem).filter(Boolean) ?? []
    expect(closedDownloadItems.find(item => item.type === 'text' && item.text === 'Скачать BPMN')).toBeFalsy()
    expect(app.events.hitTest(606, 34)?.componentId).toContain('partial-slots-root:zoom-controls')

    app.setHitTestMode('spatial')
    expect(app.events.hitTest(606, 34)?.componentId).toContain('partial-slots-root:zoom-controls')
    app.destroy()
  })

  it('downloads BPMN from custom download controls without an explicit controller prop', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback, mime?: string) {
      callback(new Blob(['png'], { type: mime ?? 'image/png' }))
    })
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:nova-modeler-export')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
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
      id: 'download-slot-root',
      props: {
        model: createModelerModel({
          id: 'download-slot',
          elements: [
            createBpmnEventElement({ id: 'start', x: 40, y: 90, eventPosition: 'start' }),
            createBpmnTaskElement({ id: 'task', x: 160, y: 74, name: 'Review request', taskType: 'user' }),
            createBpmnFlowElement({
              id: 'flow',
              source: { elementId: 'start', point: { x: 88, y: 114 } },
              target: { elementId: 'task', point: { x: 160, y: 114 } },
            }),
          ],
        }),
        width: 640,
        height: 420,
      },
      slots: {
        controls: () => [{
          type: Modeler.DownloadControls,
          id: 'slot-download-controls',
          props: { zIndex: 3000 },
        }],
      },
    })
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(24, 386)?.componentId).toBe('slot-download-controls')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 24, clientY: 386, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 24, clientY: 386, button: 0 }))
    app.raph.run()
    app.raph.run()
    expect(app.events.hitTest(44, 302)?.componentId).toContain('slot-download-controls:menu-item:bpmn')

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 302, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 44, clientY: 302, button: 0 }))
    app.raph.run()

    expect(click).toHaveBeenCalledTimes(1)
    const exportedBlobs = createObjectURL.mock.calls
      .map(call => call[0])
      .filter((value): value is Blob => value instanceof Blob && value.type.startsWith('application/xml'))
    expect(exportedBlobs).toHaveLength(1)
    const blob = exportedBlobs[0]
    expect(blob.type).toBe('application/xml;charset=utf-8')
    expect(blob.size).toBeGreaterThan(0)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:nova-modeler-export')

    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    click.mockClear()
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 24, clientY: 386, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 24, clientY: 386, button: 0 }))
    app.raph.run()
    app.raph.run()
    expect(app.events.hitTest(44, 338)?.componentId).toContain('slot-download-controls:menu-item:png')

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 44, clientY: 338, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 44, clientY: 338, button: 0 }))
    await Promise.resolve()
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    app.raph.run()

    expect(click).toHaveBeenCalledTimes(1)
    const pngBlobs = createObjectURL.mock.calls
      .map(call => call[0])
      .filter((value): value is Blob => value instanceof Blob && value.type === 'image/png')
    expect(pngBlobs).toHaveLength(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:nova-modeler-export')
    app.destroy()
    getContext.mockRestore()
    toBlob.mockRestore()
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    click.mockRestore()
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

    const target = app.events.hitTest(384, 120)
    expect(target?.componentId).toBe('context-pad-root:context-pad')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 384, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 384, clientY: 120, button: 0 }))
    app.raph.run()

    expect(root.getApi().getModel().elements).toEqual([])
    expect(root.getApi().getModel().selection).toEqual([])
    app.destroy()
  })

  it('adds a BPMN boundary event from the activity context pad', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 760, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const root = app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'boundary-context-pad-root',
      props: {
        model: createModelerModel({
          elements: [createBpmnTaskElement({ id: 'task-1', x: 220, y: 100, name: 'Task' })],
          selection: ['task-1'],
        }),
        width: 760,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(376, 120)?.componentId).toBe('boundary-context-pad-root:context-pad')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 376, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 376, clientY: 120, button: 0 }))
    app.raph.run()

    const model = root.getApi().getModel()
    expect(model.elements[1]).toMatchObject({
      type: 'bpmn.boundaryEvent',
      x: 262,
      y: 162,
      data: {
        attachedToRef: 'task-1',
        trigger: 'timer',
        isInterrupting: true,
      },
    })
    expect(model.selection).toEqual([model.elements[1]?.id])
    app.destroy()
  })

  it('keeps context pad delete actions last and labels swimlane delete buttons clearly', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const canvas = document.createElement('canvas')
    const app = Nova.createApp({
      target: canvas,
      size: { width: 720, height: 420, dpr: 1 },
      renderer: { main: RendererType.Web2D },
      scheduler: { type: RaphSchedulerType.Sync, loop: false },
    })
    registerModeler(app.schema)
    const surface = app.createSurface('modeler')
    const participant = addBpmnParticipantLane(createBpmnParticipantElement({ id: 'pool-1', x: 80, y: 80 }))
    app.schema.createNode(surface, {
      type: Modeler.Root,
      id: 'swimlane-context-pad-root',
      props: {
        model: createModelerModel({
          elements: [participant],
          selection: ['pool-1'],
        }),
        width: 720,
        height: 420,
      },
    })
    MODEL_ELEMENTS_RUNTIME.contextPadAnchors.set('pool-1', { x: 126, y: 120 }, {
      partType: 'bpmn.swimlane.lane',
      partId: participant.data.lanes[0]!.id,
    })
    app.raph.run()
    app.raph.run()

    const contextPad = app.components.require('swimlane-context-pad-root:context-pad') as unknown as {
      resolveNovaTooltipTarget(input: { x: number; y: number }): { tooltip?: unknown; rect?: ModelerRect } | null
    }
    expect(contextPad.resolveNovaTooltipTarget({ x: 150, y: 104 })?.tooltip).toMatchObject({
      value: 'Add lane below',
      placement: 'bottom',
    })
    expect(contextPad.resolveNovaTooltipTarget({ x: 326, y: 104 })?.tooltip).toMatchObject({
      value: 'Delete lane',
      placement: 'bottom',
    })
    expect(contextPad.resolveNovaTooltipTarget({ x: 370, y: 104 })?.tooltip).toMatchObject({
      value: 'Delete pool',
      placement: 'bottom',
    })
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

    expect(app.events.hitTest(296, 120)?.componentId).toBe('color-menu-root:context-pad')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 296, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 296, clientY: 120, button: 0 }))
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

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 296, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 296, clientY: 120, button: 0 }))
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

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 296, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 296, clientY: 120, button: 0 }))
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

  it('applies stroke color from the color menu for BPMN associations', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(create2DContextStub())
    const start = createBpmnEventElement({ id: 'start-1', x: 100, y: 100 })
    const task = createBpmnTaskElement({ id: 'task-1', x: 220, y: 84 })
    const association = createBpmnAssociationElement({
      id: 'association-1',
      source: { elementId: start.id, point: { x: 148, y: 124 } },
      target: { elementId: task.id, point: { x: 220, y: 124 } },
      style: { stroke: '#1f2937' },
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
      id: 'association-color-root',
      props: {
        model: createModelerModel({
          elements: [start, task, association],
          selection: [association.id],
        }),
        width: 640,
        height: 420,
      },
    }) as Root
    app.raph.run()
    app.raph.run()

    expect(app.events.hitTest(300, 148)?.componentId).toBe('association-color-root:context-pad')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 300, clientY: 148, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 300, clientY: 148, button: 0 }))
    app.raph.run()

    const picker = app.components.requireApi<ColorPickerApi>('association-color-root:context-pad:color-menu:picker')
    expect(picker.getProps().value).toBe('#1f2937')
    picker.getProps().onCommit?.('#112233', { source: 'input' })
    app.raph.run()

    const current = root.getApi().getModel().elements.find(element => element.id === association.id)
    expect(current?.style).toMatchObject({ stroke: '#112233' })
    expect(current?.style?.fill).toBeUndefined()
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

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'Escape' }))
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

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 296, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 296, clientY: 120, button: 0 }))
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

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 296, clientY: 120, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 296, clientY: 120, button: 0 }))
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

  it('moves elements fully enclosed by a BPMN group together with the group', () => {
    const controller = createModelerController({
      model: createModelerModel({
        elements: [
          createBpmnGroupElement({ id: 'group-1', x: 80, y: 80, width: 260, height: 200 }),
          createBpmnTaskElement({ id: 'task-inside', x: 130, y: 120, name: 'Inside' }),
          createBasicRectElement({ id: 'rect-partial', x: 300, y: 120, width: 80, height: 64 }),
        ],
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

    expect(moveGesture?.hitTest?.(context, offsetMouseEvent('mousedown', 92, 92), controller.hitTest({ x: 92, y: 92 }))).toBe(true)
    moveGesture?.onPointerDown?.(context, offsetMouseEvent('mousedown', 92, 92))
    moveGesture?.onPointerMove?.(context, offsetMouseEvent('mousemove', 132, 117))
    moveGesture?.onPointerUp?.(context, offsetMouseEvent('mouseup', 132, 117))

    expect(controller.getModel().selection).toEqual(['group-1'])
    expect(controller.getModel().elements).toMatchObject([
      { id: 'group-1', x: 120, y: 105 },
      { id: 'task-inside', x: 170, y: 145 },
      { id: 'rect-partial', x: 300, y: 120 },
    ])
    controller.unmount()
  })

  it('moves elements fully enclosed by BPMN participant content together with the pool', () => {
    const controller = createModelerController({
      model: createModelerModel({
        elements: [
          createBpmnParticipantElement({ id: 'pool-1', x: 80, y: 80, width: 520, height: 260 }),
          createBpmnTaskElement({ id: 'task-inside-pool', x: 240, y: 120, name: 'Inside pool' }),
          createBasicRectElement({ id: 'rect-in-header', x: 92, y: 120, width: 24, height: 24 }),
          createBasicRectElement({ id: 'rect-outside', x: 660, y: 120, width: 80, height: 64 }),
        ],
      }),
      options: {
        interaction: {
          snap: false,
        },
      },
    })
    controller.mount(createControllerHost(900, 560))
    const context = controller.getPluginContext()
    const moveGesture = controller.getGestures().find(gesture => gesture.id === 'modeler-elements:move')

    expect(moveGesture?.hitTest?.(context, offsetMouseEvent('mousedown', 92, 92), controller.hitTest({ x: 92, y: 92 }))).toBe(true)
    moveGesture?.onPointerDown?.(context, offsetMouseEvent('mousedown', 92, 92))
    moveGesture?.onPointerMove?.(context, offsetMouseEvent('mousemove', 122, 112))
    moveGesture?.onPointerUp?.(context, offsetMouseEvent('mouseup', 122, 112))

    expect(controller.getModel().selection).toEqual(['pool-1'])
    expect(controller.getModel().elements).toMatchObject([
      { id: 'pool-1', x: 110, y: 100 },
      { id: 'task-inside-pool', x: 270, y: 140 },
      { id: 'rect-in-header', x: 92, y: 120 },
      { id: 'rect-outside', x: 660, y: 120 },
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
        options: {
          branding: {
            visible: false,
          },
        },
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
    expect(paletteItems.some(item => item.type === 'line' && item.styles?.color === '#1f2937')).toBe(true)
    const palette = app.components.require('palette-root:palette') as unknown as {
      x: number
      y: number
      createLayoutPlan(options: unknown): { entries: Array<{ type: string; item?: { id: string }; x: number; y: number; size: number }> }
      resolvePaletteLayoutOptions(): unknown
    }
    const resolvePaletteItemPoint = (itemId: string) => {
      const entry = palette.createLayoutPlan(palette.resolvePaletteLayoutOptions()).entries.find(item => item.type === 'item' && item.item?.id === itemId)
      if (!entry) throw new Error(`Expected palette item ${itemId}`)
      return {
        x: palette.x + entry.x + entry.size / 2,
        y: palette.y + entry.y + entry.size / 2,
      }
    }
    const connectPoint = resolvePaletteItemPoint('element.connect.tool')
    const rectPoint = resolvePaletteItemPoint('basic.rect.create')
    const eventPoint = resolvePaletteItemPoint('bpmn.event.create')
    const gatewayPoint = resolvePaletteItemPoint('bpmn.gateway.create')

    expect(app.events.hitTest(connectPoint.x, connectPoint.y)?.componentId).toBe('palette-root:palette')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: connectPoint.x, clientY: connectPoint.y, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: connectPoint.x, clientY: connectPoint.y, button: 0 }))
    expect(root.getApi().getModel().elements).toHaveLength(0)
    expect(controller.getPluginContext().tools.getActiveId()).toBe('connect')

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: rectPoint.x, clientY: rectPoint.y, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 240, clientY: 220, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 240, clientY: 220, button: 0 }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: eventPoint.x, clientY: eventPoint.y, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 360, clientY: 260, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 360, clientY: 260, button: 0 }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: gatewayPoint.x, clientY: gatewayPoint.y, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 420, clientY: 300, button: 0 }))
    app.raph.run()
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

  it('creates BPMN flow by dragging between element bodies, cancels with Escape and edits waypoints', () => {
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

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'c' }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 144, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 220, clientY: 124, button: 0 }))
    app.raph.run()
    const interaction = app.surfaces.find(item => item.name === 'flow-create-root:interaction')
    const links = app.surfaces.find(item => item.name === 'flow-create-root:links')
    expect(links?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(true)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'bpmn-flow-preview:preview')).toBe(false)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-1:connection-port:left')).toBe(false)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-1:view')).toBe(true)
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 220, clientY: 124, button: 0 }))
    app.raph.run()

    let model = root.getApi().getModel()
    const flow = model.elements.find(element => element.type === 'bpmn.flow')!
    expect(flow).toMatchObject({
      source: { elementId: 'start-1' },
      target: { elementId: 'task-1' },
      waypoints: [{ x: 184, y: 124 }],
      data: { flowType: 'sequence' },
    })
    expect(flow.source.portId).toBeUndefined()
    expect(flow.target.portId).toBeUndefined()
    expect(model.selection).toEqual([flow.id])
    const contextPad = app.components.get('flow-create-root:context-pad') as { containsPoint?: (x: number, y: number) => boolean } | undefined
    expect(contextPad?.containsPoint?.(4, 4)).toBe(false)
    expect(contextPad?.containsPoint?.(156, 100)).toBe(false)

    root.applyCommand({ type: 'select', ids: [] })
    app.raph.run()
    expect(root.hitTest({ x: 202, y: 124 })).toEqual({ type: 'element', id: flow.id })
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 202, clientY: 124, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('pointer')

    root.applyCommand({ type: 'select', ids: ['start-1', 'task-1'] })
    app.raph.run()
    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'c' }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 144, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 220, clientY: 124, button: 0 }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 220, clientY: 124, button: 0 }))
    expect(root.getApi().getModel().elements.filter(element => element.type === 'bpmn.flow')).toHaveLength(1)

    root.applyCommand({ type: 'select', ids: [flow.id] })
    app.raph.run()
    expect(root.hitTest({ x: 202, y: 124 })).toEqual({ type: 'edge-segment-handle', elementId: flow.id, segmentIndex: 1 })
    const controller = (root as unknown as { controllerInstance: ReturnType<typeof createModelerController> }).controllerInstance
    MODEL_ELEMENTS_RUNTIME.edgeSegmentHover.set(MODEL_ELEMENTS_RUNTIME.edges.createSegmentHandleAtPoint(
      controller.getPluginContext(),
      flow,
      { x: 202, y: 124 },
    ))
    app.raph.run()
    expect(app.surfaces.find(item => item.name === 'flow-create-root:interaction')?.children
      .some(child => (child as { componentId?: string }).componentId === `${flow.id}:segment:1`)).toBe(true)
    expect(app.canvas.element.style.cursor).toBe('grab')
    const waypointGesture = controller.getGestures().find(gesture => gesture.id === 'modeler-elements:waypoint')
    waypointGesture?.onPointerDown?.(controller.getPluginContext(), offsetMouseEvent('mousedown', 202, 124))
    waypointGesture?.onPointerMove?.(controller.getPluginContext(), offsetMouseEvent('mousemove', 202, 180))
    waypointGesture?.onPointerUp?.(controller.getPluginContext(), offsetMouseEvent('mouseup', 202, 180))
    model = root.getApi().getModel()
    expect(model.elements.find(element => element.id === flow.id)).toMatchObject({
      waypoints: [{ x: 184, y: 124 }, { x: 202, y: 180 }],
    })

    waypointGesture?.onPointerDown?.(controller.getPluginContext(), offsetMouseEvent('mousedown', 184, 124))
    waypointGesture?.onPointerMove?.(controller.getPluginContext(), offsetMouseEvent('mousemove', 184, 160))
    waypointGesture?.onPointerUp?.(controller.getPluginContext(), offsetMouseEvent('mouseup', 184, 160))
    model = root.getApi().getModel()
    expect(model.elements.find(element => element.id === flow.id)).toMatchObject({
      waypoints: [{ x: 202, y: 180 }],
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
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-1:connection-port:left')).toBe(false)
    expect(interaction?.children.some(child => (child as { componentId?: string }).componentId === 'task-1:view')).toBe(true)
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 224, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 224, clientY: 124, button: 0 }))
    let flows = root.getApi().getModel().elements.filter(element => element.type === 'bpmn.flow')
    expect(flows).toHaveLength(1)

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'c' }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 144, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 144, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 224, clientY: 124, button: 0 }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 224, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 224, clientY: 124, button: 0 }))
    flows = root.getApi().getModel().elements.filter(element => element.type === 'bpmn.flow')
    expect(flows).toHaveLength(1)
    expect(root.getApi().getModel().selection).toEqual([flows[0]?.id])

    app.handleEvent('keydown', new KeyboardEvent('keydown', { key: 'c' }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 336, clientY: 124, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 420, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 420, clientY: 124, button: 0 }))

    flows = root.getApi().getModel().elements.filter(element => element.type === 'bpmn.flow')
    expect(flows).toHaveLength(2)
    expect(flows[0]).toMatchObject({
      source: { elementId: 'start-1' },
      target: { elementId: 'task-1' },
    })
    expect(flows[0]?.source.portId).toBeUndefined()
    expect(flows[0]?.target.portId).toBeUndefined()
    expect(flows[1]).toMatchObject({
      source: { elementId: 'task-1' },
      target: { elementId: 'gateway-1' },
    })
    expect(flows[1]?.source.portId).toBeUndefined()
    expect(flows[1]?.target.portId).toBeUndefined()
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

    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 272, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 272, clientY: 124, button: 0 }))
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
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 272, clientY: 124, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 272, clientY: 124, button: 0 }))
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
          palette: {
            offsetY: 0,
            itemSize: 16,
            gap: 2,
            gripSize: 24,
          },
        },
      },
    })
    app.raph.run()
    app.raph.run()

    const palette = app.components.require('palette-drag-root:palette') as unknown as {
      x: number
      y: number
      createLayoutPlan(options: unknown): { entries: Array<{ type: string; x: number; y: number; width: number; height: number }> }
      resolvePaletteLayoutOptions(): unknown
    }
    const resolveGripPoint = () => {
      const grip = palette.createLayoutPlan(palette.resolvePaletteLayoutOptions()).entries.find(entry => entry.type === 'grip')
      if (!grip) throw new Error('Expected palette grip')
      return {
        x: palette.x + grip.x + grip.width / 2,
        y: palette.y + grip.y + grip.height / 2,
      }
    }
    const dockedGrip = resolveGripPoint()
    expect(app.events.hitTest(dockedGrip.x, dockedGrip.y)?.componentId).toBe('palette-drag-root:palette')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: dockedGrip.x, clientY: dockedGrip.y, button: 0 }))
    expect(app.canvas.element.style.cursor).toBe('grabbing')
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 140, clientY: 392, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 140, clientY: 392, button: 0 }))
    app.raph.run()

    expect(app.events.hitTest(140, 392)?.componentId).toBe('palette-drag-root:palette')
    expect(app.events.hitTest(dockedGrip.x, dockedGrip.y)?.componentId).not.toBe('palette-drag-root:palette')

    const floatingGrip = resolveGripPoint()
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: floatingGrip.x, clientY: floatingGrip.y, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: floatingGrip.x, clientY: floatingGrip.y, button: 0 }))
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: floatingGrip.x, clientY: floatingGrip.y, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: floatingGrip.x, clientY: floatingGrip.y, button: 0 }))
    app.raph.run()

    expect(app.events.hitTest(dockedGrip.x, dockedGrip.y)?.componentId).toBe('palette-drag-root:palette')
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
    expect(app.events.hitTest(300, 380)?.componentId).not.toBe('palette-no-drag-root:palette')
    app.handleEvent('mousedown', new MouseEvent('mousedown', { clientX: 300, clientY: 380, button: 0 }))
    app.handleEvent('mousemove', new MouseEvent('mousemove', { clientX: 340, clientY: 408, button: 0 }))
    app.handleEvent('mouseup', new MouseEvent('mouseup', { clientX: 340, clientY: 408, button: 0 }))
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

function createValidBpmnProcessElements() {
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

function validateBpmnRules(elements: ReturnType<typeof createModelerModel>['elements']): Array<string> {
  return BpmnValidationRuntime.validate(createModelerModel({ elements })).issues.map(issue => issue.ruleId)
}

function createValidationResult(modelVersion: number, status: ModelerValidationResult['status']): ModelerValidationResult {
  return {
    status,
    modelVersion,
    issues: status === 'valid'
      ? []
      : [{
          id: 'test',
          ruleId: 'bpmn.noNodes',
          severity: 'error',
          message: 'Invalid test model.',
          elementIds: [],
        }],
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

function createMeasured2DContextStub(): CanvasRenderingContext2D {
  const context = create2DContextStub()
  context.measureText = vi.fn((text: string) => ({ width: text.length * 7 })) as unknown as CanvasRenderingContext2D['measureText']
  return context
}

function pickInputProps(props: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    'variant',
    'align',
    'wrap',
    'resize',
    'minRows',
    'maxRows',
    'color',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'background',
    'border',
    'hoverBackground',
    'pressedBackground',
    'activeBackground',
    'focusBorderColor',
    'selectOnFocus',
  ]
  return Object.fromEntries(keys.map(key => [key, props[key]]))
}
