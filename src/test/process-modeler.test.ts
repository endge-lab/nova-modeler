import { describe, expect, it } from 'vitest'
import {
  ProcessModeler,
  areProcessPortsCompatible,
  canUseProcessPortForDirection,
  compileLowCodeManifest,
  createProcessElementCatalog,
  createProcessModel,
  createProcessModelStore,
  createProcessModelerLayout,
  exportBpmnXml,
  findProcessElement,
  findProcessNodePort,
  getBuiltinProcessElementCatalog,
  getDefaultProcessPort,
  getDefaultProcessPorts,
  hitTestProcessModelerLayout,
  importBpmnXml,
  isProcessPortCapacityExceeded,
  normalizeProcessPortDefinition,
  normalizeProcessPortInput,
  normalizeEdge,
  normalizeLane,
  normalizeMetadata,
  normalizeNode,
  normalizePool,
  normalizeViewport,
  processModelBounds,
  registerProcessElement,
  resolveProcessEdgePortIds,
  resolveProcessNodePortDefinitions,
  resolveProcessNodePorts,
  validateProcessModel,
} from '@/index'
import type { ProcessModelInput } from '@/model/types/process-modeler.types'

describe('process model core', () => {
  it('creates normalized models and clones mutable inputs', () => {
    const input: ProcessModelInput = {
      id: 'approval',
      metadata: { name: 'Approval', tags: ['ops'], custom: { owner: 'lab' } },
      viewport: { scale: 0 },
      nodes: [{ id: 'start', kind: 'startEvent' }],
      edges: [{ id: 'flow', sourceId: 'start', targetId: 'missing' }],
      pools: [{ id: 'pool', lanes: [{ id: 'lane' }] }],
      selection: ['start', 'start'],
    }
    const model = createProcessModel(input)

    expect(model.id).toBe('approval')
    expect(model.viewport.scale).toBe(0.1)
    expect(model.nodes[0]).toMatchObject({ width: 42, height: 42 })
    expect(model.edges[0].kind).toBe('sequenceFlow')
    expect(model.pools[0].lanes[0].kind).toBe('lane')
    expect(model.selection).toEqual(['start'])
    expect(model.metadata.tags).not.toBe(input.metadata?.tags)
    expect(normalizeViewport({ scale: 99 }).scale).toBe(4)
    expect(normalizeMetadata({ custom: { x: 1 }, tags: ['a'] })).toEqual({ custom: { x: 1 }, tags: ['a'] })
    expect(normalizeNode({ id: 'task', kind: 'userTask', x: Number.NaN, y: 2 }).x).toBe(0)
    expect(normalizeEdge({ id: 'e', sourceId: 'a', targetId: 'b', sourcePortId: 'out', targetPortId: 'in', waypoints: [{ x: Number.NaN, y: 1 }] })).toMatchObject({ sourcePortId: 'out', targetPortId: 'in' })
    expect(normalizePool({ id: 'p', x: Number.NaN }).width).toBe(860)
    expect(normalizeLane({ id: 'l', y: Number.NaN }).height).toBe(140)
  })

  it('applies commands and supports undo redo', () => {
    const store = createProcessModelStore(sampleModel())

    expect(store.undo().id).toBe('sample')
    expect(store.redo().id).toBe('sample')
    store.applyCommand({ type: 'addNode', node: { id: 'review', kind: 'userTask', x: 300, y: 40, metadata: { formId: 'review-form' } } })
    store.applyCommand({ type: 'addNode', node: { id: 'review', kind: 'userTask', x: 320, y: 70 }, select: false })
    store.applyCommand({ type: 'moveNode', id: 'review', dx: 10, dy: 20 })
    store.applyCommand({ type: 'connect', sourceId: 'task', targetId: 'review', metadata: { condition: 'approved' }, select: false })
    store.applyCommand({ type: 'connect', id: 'flow-review', sourceId: 'task', targetId: 'review', sourcePortId: 'out', targetPortId: 'in', metadata: { condition: 'approved' } })
    store.applyCommand({ type: 'connect', id: 'flow-review', sourceId: 'task', targetId: 'review', metadata: { condition: 'updated' } })
    store.applyCommand({ type: 'select', ids: ['review'], mode: 'append' })
    store.applyCommand({ type: 'select', ids: ['review'], mode: 'toggle' })
    store.applyCommand({ type: 'select', ids: ['missing'], mode: 'replace' })
    store.applyCommand({ type: 'select', ids: ['review'] })
    store.applyCommand({ type: 'updateMetadata', id: 'review', metadata: { name: 'Review', actionId: 'notify' } })
    store.applyCommand({ type: 'updateMetadata', id: 'sample', metadata: { description: 'Root metadata' } })
    store.applyCommand({ type: 'updateMetadata', id: 'flow-review', metadata: { name: 'Review flow' } })
    store.applyCommand({ type: 'setViewport', viewport: { x: 12, y: 14, scale: 1.2 } })

    let model = store.getModel()
    expect(model.nodes.find(node => node.id === 'review')).toMatchObject({ x: 330, y: 90, metadata: { name: 'Review', actionId: 'notify' } })
    expect(model.metadata.description).toBe('Root metadata')
    expect(model.edges.find(edge => edge.id === 'flow-review')?.metadata).toMatchObject({ condition: 'updated', name: 'Review flow' })
    expect(model.edges.find(edge => edge.id === 'flow-review')).toMatchObject({ sourcePortId: 'out', targetPortId: 'in' })
    expect(model.viewport).toEqual({ x: 12, y: 14, scale: 1.2 })
    expect(findProcessElement(model, 'review')?.id).toBe('review')

    store.applyCommand({ type: 'delete', ids: ['review'] })
    expect(store.getModel().nodes.some(node => node.id === 'review')).toBe(false)
    model = store.undo()
    expect(model.nodes.some(node => node.id === 'review')).toBe(true)
    model = store.redo()
    expect(model.nodes.some(node => node.id === 'review')).toBe(false)
    expect(store.historyState().undo).toBeGreaterThan(0)
    store.applyCommand({ type: 'setModel', model: sampleModel() })
    store.setModel(sampleModel())
    store.setModel(sampleModel(), false)
    expect(store.historyState().redo).toBe(0)
    expect(() => store.applyCommand({ type: 'unknown' } as never)).toThrow('Unsupported process command')
  })

  it('updates pools, lanes and caps undo history', () => {
    const store = createProcessModelStore({
      id: 'pool-model',
      nodes: [{ id: 'start', kind: 'startEvent' }, { id: 'end', kind: 'endEvent' }],
      edges: [{ id: 'flow', sourceId: 'start', targetId: 'end' }],
      pools: [{ id: 'pool', lanes: [{ id: 'lane-a' }, { id: 'lane-b' }] }],
      selection: ['pool', 'lane-a'],
    })

    store.applyCommand({ type: 'updateMetadata', id: 'pool', metadata: { name: 'Operations' } })
    store.applyCommand({ type: 'updateMetadata', id: 'lane-a', metadata: { name: 'Backoffice' } })
    let model = store.getModel()
    expect(findProcessElement(model, 'pool')?.metadata.name).toBe('Operations')
    expect(findProcessElement(model, 'lane-a')?.metadata.name).toBe('Backoffice')

    store.applyCommand({ type: 'delete', ids: ['lane-a'] })
    model = store.getModel()
    expect(findProcessElement(model, 'lane-a')).toBeUndefined()
    expect(model.selection).toEqual(['pool'])

    for (let index = 0; index < 105; index += 1) {
      store.applyCommand({ type: 'setViewport', viewport: { x: index } })
    }
    expect(store.historyState().undo).toBe(100)
  })

  it('validates required BPMN v1 invariants', () => {
    expect(validateProcessModel(createProcessModel()).map(issue => issue.code)).toEqual(['missing-start', 'missing-end'])

    const invalid = createProcessModel({
      id: 'invalid',
      nodes: [
        { id: 'start', kind: 'startEvent' },
        { id: 'start', kind: 'endEvent' },
        { id: 'gateway', kind: 'exclusiveGateway' },
        { id: 'orphan', kind: 'serviceTask' },
      ],
      edges: [
        { id: 'dangling', sourceId: '', targetId: 'missing' },
        { id: 'bad-target', sourceId: 'start', targetId: 'missing' },
      ],
      issues: [{ code: 'unsupported', severity: 'info', message: 'Unsupported import.' }],
    })
    const codes = validateProcessModel(invalid).map(issue => issue.code)
    expect(codes).toContain('duplicate-id')
    expect(codes).toContain('dangling-edge')
    expect(codes).toContain('invalid-edge-target')
    expect(codes).toContain('orphan-node')
    expect(codes).toContain('invalid-gateway')
    expect(codes).toContain('unsupported')
    expect(validateProcessModel(createProcessModel(sampleModel())).map(issue => issue.code)).toEqual([])
  })

  it('normalizes and validates connection ports', () => {
    const defaultPorts = getDefaultProcessPorts('userTask')
    expect(defaultPorts.map(port => port.id)).toEqual(['in', 'out'])
    expect(defaultPorts[0].metadata).toEqual({})
    expect(normalizeProcessPortInput(undefined, 'userTask')).toBeUndefined()
    expect(normalizeProcessPortInput(false, 'userTask')).toEqual([])
    expect(normalizeProcessPortInput([{ id: 'top-in', direction: 'input', side: 'top', align: 2, offset: Number.NaN, enabled: false, capacity: 1, accepts: ['sequenceFlow'], metadata: { name: 'Port', description: 'Description', formId: 'f', actionId: 'a', assignee: 'u', condition: 'ok', tags: ['x'], custom: { tone: 'a' } } }], 'userTask')?.[0]).toMatchObject({
      id: 'top-in',
      align: 1,
      offset: 0,
      enabled: false,
      metadata: { name: 'Port', description: 'Description', formId: 'f', actionId: 'a', assignee: 'u', condition: 'ok', tags: ['x'], custom: { tone: 'a' } },
    })
    expect(normalizeProcessPortDefinition({ id: 'bottom', direction: 'bidirectional', side: 'bottom', align: Number.NaN }).align).toBe(0.5)

    const model = createProcessModel({
      id: 'ports',
      nodes: [
        { id: 'start', kind: 'startEvent', ports: [{ id: 'custom-out', direction: 'output', side: 'bottom', capacity: 1 }] },
        { id: 'task', kind: 'userTask', ports: [{ id: 'custom-in', direction: 'input', side: 'top', accepts: ['sequenceFlow'] }, { id: 'disabled-out', direction: 'output', side: 'right', enabled: false }] },
        { id: 'end', kind: 'endEvent' },
      ],
      edges: [
        { id: 'valid', sourceId: 'start', targetId: 'task', sourcePortId: 'custom-out', targetPortId: 'custom-in' },
        { id: 'over-capacity', sourceId: 'start', targetId: 'end', sourcePortId: 'custom-out', targetPortId: 'in' },
        { id: 'disabled', sourceId: 'task', targetId: 'end', sourcePortId: 'disabled-out', targetPortId: 'in' },
        { id: 'missing-port', sourceId: 'start', targetId: 'task', sourcePortId: 'missing', targetPortId: 'custom-in' },
      ],
    })
    const source = model.nodes[0]
    const target = model.nodes[1]
    const sourcePort = findProcessNodePort(source, 'custom-out', 'output')!
    const targetPort = findProcessNodePort(target, 'custom-in', 'input')!
    const clonedPorts = createProcessModelStore(model).getModel().nodes[0].ports

    expect(resolveProcessNodePortDefinitions(source)).toHaveLength(1)
    expect(getDefaultProcessPort(target, 'input')?.id).toBe('custom-in')
    expect(findProcessNodePort(target, undefined, 'input')?.id).toBe('custom-in')
    expect(resolveProcessEdgePortIds(source, target, model.edges[0])).toEqual({ sourcePortId: 'custom-out', targetPortId: 'custom-in' })
    expect(canUseProcessPortForDirection(sourcePort, 'output')).toBe(true)
    expect(canUseProcessPortForDirection(targetPort, 'input')).toBe(true)
    expect(canUseProcessPortForDirection(sourcePort, 'input')).toBe(false)
    expect(canUseProcessPortForDirection(targetPort, 'output')).toBe(false)
    expect(canUseProcessPortForDirection({ ...targetPort, accepts: [] }, 'input')).toBe(false)
    expect(canUseProcessPortForDirection({ ...sourcePort, emits: [] }, 'output')).toBe(false)
    expect(areProcessPortsCompatible(sourcePort, targetPort)).toBe(true)
    expect(areProcessPortsCompatible(sourcePort, { ...targetPort, enabled: false })).toBe(false)
    expect(isProcessPortCapacityExceeded(sourcePort, 2)).toBe(true)
    expect(clonedPorts?.[0]).toMatchObject({ id: 'custom-out' })
    expect(validateProcessModel(model).map(issue => issue.code)).toContain('invalid-port')
  })
})

describe('BPMN XML and low-code manifest', () => {
  it('imports supported BPMN XML and records unsupported elements', () => {
    const model = importBpmnXml(`<?xml version="1.0"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
        <bpmn:process id="imported" name="Imported">
          <bpmn:startEvent id="start" name="Start" />
          <bpmn:userTask id="task" name="Task" />
          <bpmn:endEvent id="end" name="End" />
          <bpmn:timerEventDefinition id="timer" />
          <bpmn:manualTask />
          <bpmn:sequenceFlow id="flow-1" sourceRef="start" targetRef="task">
            <bpmn:conditionExpression>ok</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="flow-2" sourceRef="task" targetRef="end" />
        </bpmn:process>
        <bpmndi:BPMNShape bpmnElement="task"><dc:Bounds x="100" y="80" width="150" height="74" /></bpmndi:BPMNShape>
      </bpmn:definitions>`)

    expect(model.id).toBe('imported')
    expect(model.nodes.find(node => node.id === 'task')).toMatchObject({ x: 100, y: 80, width: 150 })
    expect(model.edges[0].metadata.condition).toBe('ok')
    expect(model.issues[0].code).toBe('unsupported')
    expect(() => importBpmnXml('<bad>')).toThrow('Invalid BPMN XML.')

    const fallback = importBpmnXml(`<?xml version="1.0"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
        <bpmn:startEvent />
        <bpmn:sequenceFlow id="loose" />
        <bpmndi:BPMNShape bpmnElement="generated"><dc:Bounds x="bad" y="bad" width="bad" height="bad" /></bpmndi:BPMNShape>
        <bpmndi:BPMNShape bpmnElement="without-bounds" />
      </bpmn:definitions>`)
    expect(fallback.id).toMatch(/^process-/)
    expect(fallback.nodes[0].id).toMatch(/^startEvent-/)
    expect(fallback.issues).toEqual([])
    expect(exportBpmnXml(createProcessModel({ id: 'empty-export' }))).toContain('<bpmn:process id="empty-export"')
  })

  it('exports BPMN XML and compiles low-code manifest', () => {
    const model = createProcessModel({
      ...sampleModel(),
      nodes: [
        ...sampleModel().nodes!,
        { id: 'gateway', kind: 'exclusiveGateway', x: 300, y: 180, metadata: { name: 'Decision' } },
        { id: 'gateway-2', kind: 'parallelGateway', x: 300, y: 280 },
        { id: 'service', kind: 'serviceTask', x: 500, y: 180 },
      ],
      edges: [
        ...sampleModel().edges!,
        { id: 'flow-gateway-a', sourceId: 'task', targetId: 'gateway' },
        { id: 'flow-gateway-b', sourceId: 'gateway', targetId: 'service', metadata: { name: 'Service path', condition: 'service' } },
        { id: 'flow-gateway-c', sourceId: 'gateway', targetId: 'end', metadata: { condition: 'skip' } },
        { id: 'flow-gateway-2-a', sourceId: 'task', targetId: 'gateway-2' },
        { id: 'flow-gateway-2-b', sourceId: 'gateway-2', targetId: 'service' },
        { id: 'flow-gateway-2-c', sourceId: 'gateway-2', targetId: 'end' },
      ],
    })
    const xml = exportBpmnXml(model)
    expect(xml).toContain('<bpmn:process id="sample"')
    expect(xml).toContain('<bpmn:userTask id="task"')
    expect(xml).toContain('<bpmn:serviceTask id="service"')
    expect(xml).toContain('<bpmn:conditionExpression>done</bpmn:conditionExpression>')

    const manifest = compileLowCodeManifest(model)
    expect(manifest.id).toBe('sample')
    expect(manifest.tasks.find(task => task.id === 'task')).toMatchObject({ formId: 'request-form', actionId: 'create-ticket' })
    expect(manifest.gateways[0]).toMatchObject({ id: 'gateway', incoming: ['flow-gateway-a'], outgoing: ['flow-gateway-b', 'flow-gateway-c'] })
    expect(manifest.gateways[1].name).toBe('gateway-2')
    expect(manifest.forms).toEqual(['request-form'])
    expect(manifest.actions).toEqual(['create-ticket'])
    expect(manifest.transitions).toHaveLength(8)
    const portAware = compileLowCodeManifest(createProcessModel({ ...sampleModel(), edges: [{ id: 'port-flow', sourceId: 'start', targetId: 'task', sourcePortId: 'out', targetPortId: 'in' }] }))
    expect(portAware.transitions[0]).toMatchObject({ sourcePortId: 'out', targetPortId: 'in' })
    expect(compileLowCodeManifest(createProcessModel({ id: 'fallback-manifest' })).name).toBe('fallback-manifest')
  })
})

describe('layout and hit-test', () => {
  it('creates indexed layout, bounds and hit targets', () => {
    const model = createProcessModel(sampleModel())
    const layout = createProcessModelerLayout(model, { width: 1000, height: 600 })

    expect(layout.diagnostics).toMatchObject({ nodeCount: 3, edgeCount: 2 })
    expect(layout.ports.length).toBeGreaterThan(0)
    expect(processModelBounds(model)).toMatchObject({ x: 40, y: 60 })
    expect(hitTestProcessModelerLayout(layout, { x: 28, y: 84 })).toMatchObject({ type: 'palette', kind: 'startEvent' })
    expect(hitTestProcessModelerLayout(layout, { x: 28, y: 500 }).type).toBe('empty')
    expect(hitTestProcessModelerLayout(layout, layout.ports.find(port => port.nodeId === 'start' && port.id === 'out')!)).toMatchObject({ type: 'port', nodeId: 'start', portId: 'out' })
    expect(hitTestProcessModelerLayout(layout, { x: layout.nodes[1].x + 10, y: layout.nodes[1].y + 10 })).toMatchObject({ type: 'node', id: 'task' })
    expect(hitTestProcessModelerLayout(layout, layout.edges[0].points[1])).toMatchObject({ type: 'edge', id: 'flow-1' })
    expect(hitTestProcessModelerLayout(layout, { x: 800, y: 40 }).type).toBe('inspector')
    expect(hitTestProcessModelerLayout(layout, { x: 800, y: 550 }).type).toBe('validation')
    expect(hitTestProcessModelerLayout(layout, { x: 500, y: 500 }).type).toBe('canvas')
    expect(hitTestProcessModelerLayout(layout, { x: -10, y: -10 }).type).toBe('empty')
    expect(processModelBounds(createProcessModel()).width).toBe(1)

    const broken = createProcessModel({ nodes: [{ id: 'a', kind: 'startEvent' }], edges: [{ id: 'bad', sourceId: 'a', targetId: 'x' }] })
    expect(createProcessModelerLayout(broken, { width: 800, height: 400 }).edges[0].invalid).toBe(true)
    const noPorts = createProcessModel({
      nodes: [{ id: 'a', kind: 'startEvent', ports: false }, { id: 'b', kind: 'endEvent', ports: false }],
      edges: [{ id: 'fallback', sourceId: 'a', targetId: 'b' }],
    })
    const noPortLayout = createProcessModelerLayout(noPorts, { width: 800, height: 400, paletteWidth: 0 })
    expect(noPortLayout.edges[0].points[0].x).toBe(noPortLayout.nodes[0].x + noPortLayout.nodes[0].width)
    expect(noPortLayout.edges[0].points.at(-1)?.x).toBe(noPortLayout.nodes[1].x)
    const missingPortLayout = createProcessModelerLayout(createProcessModel({
      nodes: [
        { id: 'a', kind: 'startEvent' },
        { id: 'b', kind: 'endEvent' },
      ],
      edges: [{ id: 'missing-port-layout', sourceId: 'a', targetId: 'b', sourcePortId: 'missing', targetPortId: 'missing' }],
    }), { width: 800, height: 400, paletteWidth: 0 })
    expect(missingPortLayout.edges[0].sourcePortId).toBeUndefined()
    const zeroEdgeLayout = createProcessModelerLayout(createProcessModel({
      nodes: [{ id: 'zero', kind: 'userTask', width: 0, height: 0, ports: false }],
      edges: [{ id: 'zero-flow', sourceId: 'zero', targetId: 'zero' }],
    }), { width: 800, height: 400, paletteWidth: 0 })
    expect(hitTestProcessModelerLayout(zeroEdgeLayout, { x: zeroEdgeLayout.edges[0].points[0].x + 1, y: zeroEdgeLayout.edges[0].points[0].y + 1 })).toMatchObject({ type: 'edge', id: 'zero-flow' })

    const selfLoop = createProcessModel({
      nodes: [{ id: 'loop', kind: 'userTask', width: 0, height: -1 }],
      edges: [{ id: 'self', sourceId: 'loop', targetId: 'loop', waypoints: [{ x: 0, y: 0 }] }],
    })
    expect(createProcessModelStore(selfLoop).getModel().edges[0].waypoints?.[0]).toEqual({ x: 0, y: 0 })
    const selfLayout = createProcessModelerLayout(selfLoop, { width: 800, height: 400 })
    expect(selfLayout.edges[0].points).toHaveLength(4)
  })

  it('resolves custom side ports and exposes element catalog defaults', () => {
    const model = createProcessModel({
      nodes: [
        { id: 'a', kind: 'userTask', x: 10, y: 20, ports: [{ id: 'top-out', direction: 'output', side: 'top', align: 0.25 }] },
        { id: 'b', kind: 'serviceTask', x: 200, y: 20, ports: [{ id: 'bottom-in', direction: 'input', side: 'bottom', align: 0.75 }] },
      ],
      edges: [{ id: 'flow', sourceId: 'a', targetId: 'b', sourcePortId: 'top-out', targetPortId: 'bottom-in' }],
    })
    const layout = createProcessModelerLayout(model, { width: 800, height: 400, paletteWidth: 0 })
    const sourcePort = layout.ports.find(port => port.id === 'top-out')!
    const targetPort = layout.ports.find(port => port.id === 'bottom-in')!
    expect(sourcePort.worldX).toBe(47)
    expect(targetPort.worldY).toBe(96)
    expect(layout.edges[0].points[0]).toMatchObject({ x: sourcePort.x, y: sourcePort.y })
    expect(layout.edges[0].points.at(-1)).toMatchObject({ x: targetPort.x, y: targetPort.y })
    expect(resolveProcessNodePorts(model.nodes[0], layout.nodes[0], model.edges, model.viewport.scale)[0].connectionCount).toBe(1)
    expect(resolveProcessNodePorts(model.nodes[1], layout.nodes[1], model.edges, model.viewport.scale)[0].connectionCount).toBe(1)
    const legacyPorts = resolveProcessNodePorts(createProcessModel(sampleModel()).nodes[1], createProcessModelerLayout(createProcessModel(sampleModel()), { width: 800, height: 400 }).nodes[1], createProcessModel(sampleModel()).edges, 1)
    expect(legacyPorts.map(port => port.connectionCount)).toEqual([1, 1])

    const catalog = getBuiltinProcessElementCatalog()
    expect(catalog.all().map(item => item.kind)).toContain('exclusiveGateway')
    expect(catalog.require('userTask').ports.map(port => port.id)).toEqual(['in', 'out'])
    const custom = createProcessElementCatalog()
    registerProcessElement(custom, { ...catalog.require('startEvent'), label: 'Custom start' })
    expect(custom.get('startEvent')?.label).toBe('Custom start')
    expect(() => custom.require('endEvent')).toThrow('is not registered')
  })

  it('exposes public schema names', () => {
    expect(ProcessModeler.Root).toBe('ProcessModeler.Root')
  })
})

function sampleModel(): ProcessModelInput {
  return {
    id: 'sample',
    metadata: { name: 'Sample' },
    nodes: [
      { id: 'start', kind: 'startEvent', x: 40, y: 80, metadata: { name: 'Start' } },
      { id: 'task', kind: 'userTask', x: 160, y: 60, metadata: { name: 'Request', formId: 'request-form', actionId: 'create-ticket', assignee: 'ops' } },
      { id: 'end', kind: 'endEvent', x: 380, y: 80, metadata: { name: 'Done' } },
    ],
    edges: [
      { id: 'flow-1', sourceId: 'start', targetId: 'task' },
      { id: 'flow-2', sourceId: 'task', targetId: 'end', metadata: { condition: 'done' } },
    ],
  }
}
