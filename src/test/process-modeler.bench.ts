import { describe, expect, it } from 'vitest'
import {
  compileLowCodeManifest,
  createProcessModel,
  createProcessModelStore,
  createProcessModelerLayout,
  exportBpmnXml,
  hitTestProcessModelerLayout,
  importBpmnXml,
  validateProcessModel,
} from '@/index'
import type { ProcessModelInput } from '@/model/types/process-modeler.types'

describe('ProcessModeler benchmarks', () => {
  it('keeps model operations, validation, layout, hit-test and serialization bounded', () => {
    const sizes = [100, 1_000, 10_000]
    const results = sizes.map(size => runScenario(size))

    expect(results[0].nodes).toBe(100)
    expect(results[1].issues).toBe(0)
    expect(results[2].layoutItems).toBeGreaterThan(10_000)
    expect(results[2].hitTarget).toBe('node')
  })
})

function runScenario(nodes: number) {
  const model = createProcessModel(createLinearModel(nodes))
  const store = createProcessModelStore(model)
  store.applyCommand({ type: 'moveNode', id: 'task-1', dx: 4, dy: 6 })
  const issues = validateProcessModel(store.getModel())
  const layout = createProcessModelerLayout(store.getModel(), { width: 1440, height: 900 })
  const middle = layout.nodes[Math.floor(layout.nodes.length / 2)]
  const hit = hitTestProcessModelerLayout(layout, { x: middle.x + 4, y: middle.y + 4 })
  const manifest = compileLowCodeManifest(store.getModel())
  const xml = exportBpmnXml(store.getModel())
  const imported = importBpmnXml(xml)

  expect(manifest.tasks.length).toBe(nodes)
  expect(imported.nodes.length).toBe(nodes + 2)

  return {
    nodes,
    issues: issues.length,
    layoutItems: layout.diagnostics.indexedItems,
    hitTarget: hit.type,
  }
}

function createLinearModel(taskCount: number): ProcessModelInput {
  const nodes: ProcessModelInput['nodes'] = [
    { id: 'start', kind: 'startEvent', x: 0, y: 0, metadata: { name: 'Start' } },
    ...Array.from({ length: taskCount }, (_item, index) => ({
      id: `task-${index}`,
      kind: 'userTask' as const,
      x: 120 + index * 160,
      y: index % 2 === 0 ? 0 : 120,
      metadata: { name: `Task ${index}`, formId: `form-${index % 12}`, actionId: `action-${index % 8}` },
    })),
    { id: 'end', kind: 'endEvent', x: 120 + taskCount * 160, y: 0, metadata: { name: 'End' } },
  ]
  const edges: ProcessModelInput['edges'] = [
    { id: 'flow-start', sourceId: 'start', targetId: 'task-0' },
    ...Array.from({ length: taskCount - 1 }, (_item, index) => ({
      id: `flow-${index}`,
      sourceId: `task-${index}`,
      targetId: `task-${index + 1}`,
    })),
    { id: 'flow-end', sourceId: `task-${taskCount - 1}`, targetId: 'end' },
  ]

  return { id: `linear-${taskCount}`, nodes, edges }
}
