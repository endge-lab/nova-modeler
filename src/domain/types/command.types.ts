import type { ModelerViewport } from '@/domain/types/geometry.types'

export type ModelerCommand =
  | { type: 'setViewport'; viewport: Partial<ModelerViewport> }
  | { type: 'select'; ids: Array<string> }
