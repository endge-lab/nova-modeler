import { describe, expect, it } from 'vitest'
import {
  MiniMapPlugin,
  appendGridSchema,
  createGridRenderPlan,
  createModelerController,
  createModelerModel,
} from '@/index'
import type { NovaSchema } from '@endge/nova'

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
    expect(elapsed).toBeLessThan(500)
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
})
