import type {
  ModelerEdgeElement,
  ModelerElement,
  ModelerExternalLabelAdapter,
  ModelerExternalLabelResolveContext,
  ModelerPoint,
  ModelerRect,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'

export interface BpmnNodeExternalLabelLocalLayout {
  rect: ModelerRect
}

export function createBpmnNodeExternalLabelAdapter<TElement extends ModelerElement>(resolveLayout: (element: TElement) => BpmnNodeExternalLabelLocalLayout): ModelerExternalLabelAdapter<TElement> {
  return {
    getText: (_context, element) => normalizeName(element.data?.name),
    getDefaultRect: (_context, element) => {
      const center = {
        x: element.x + element.width / 2,
        y: element.y + element.height / 2,
      }
      const layout = resolveLayout(element)
      return {
        x: center.x + layout.rect.x,
        y: center.y + layout.rect.y,
        width: layout.rect.width,
        height: layout.rect.height,
      }
    },
    getAnchorPoint: (_context, element) => ({
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
    }),
  }
}

export function createBpmnEdgeExternalLabelAdapter<TElement extends ModelerEdgeElement>(): ModelerExternalLabelAdapter<TElement> {
  return {
    getText: (_context, element) => normalizeName(element.data?.name),
    getDefaultRect: (context, element) => {
      const text = normalizeName(element.data?.name)
      const anchor = resolveBpmnEdgeLabelAnchor(context, element)
      const width = Math.min(180, Math.max(72, Math.ceil(text.length * 7) + 18))
      const height = 32
      return {
        x: anchor.x - width / 2,
        y: anchor.y - height / 2 - 18,
        width,
        height,
      }
    },
    getAnchorPoint: (context, element) => resolveBpmnEdgeLabelAnchor(context, element),
  }
}

export function patchBpmnExternalLabelText<TElement extends ModelerElement>(element: TElement, text: string): TElement {
  return {
    ...element,
    data: {
      ...(element.data ?? {}),
      name: normalizeName(text) || undefined,
    },
  }
}

function resolveBpmnEdgeLabelAnchor(context: ModelerExternalLabelResolveContext, element: ModelerEdgeElement): ModelerPoint {
  const path = isModelerEdgeElement(element)
    ? MODEL_ELEMENTS_RUNTIME.edges.createPath(context as never, element)
    : []
  return resolvePathMidpoint(path) ?? { x: element.x, y: element.y }
}

function resolvePathMidpoint(path: Array<ModelerPoint>): ModelerPoint | null {
  if (path.length === 0) return null
  if (path.length === 1) return path[0]!
  let total = 0
  for (let index = 0; index < path.length - 1; index += 1) {
    total += distance(path[index]!, path[index + 1]!)
  }
  if (total <= 0.001) return path[0]!
  const target = total / 2
  let walked = 0
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]!
    const end = path[index + 1]!
    const segment = distance(start, end)
    if (walked + segment >= target) {
      const ratio = segment <= 0.001 ? 0 : (target - walked) / segment
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      }
    }
    walked += segment
  }
  return path[path.length - 1]!
}

function distance(a: ModelerPoint, b: ModelerPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
