import type { ModelerElement } from '@/domain/types/elements/element.types'
import type { ModelerRect, ModelerViewport } from '@/domain/types/model/geometry.types'

export type ModelerCommand =
  | { type: 'setViewport'; viewport: Partial<ModelerViewport> }
  | { type: 'select'; ids: Array<string> }
  | { type: 'element.add'; element: ModelerElement }
  | { type: 'element.patch'; id: string; patch: Partial<ModelerElement> }
  | { type: 'element.resize'; id: string; bounds: Partial<ModelerRect> }
  | { type: 'element.move'; id: string; dx: number; dy: number }
  | { type: 'element.rotate'; id: string; rotation: number }
