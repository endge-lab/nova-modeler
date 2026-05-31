import type { ModelerElementStyle } from '@/domain/types/elements/element-style.types'

export interface ModelerElement<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  zIndex?: number
  data?: TData
  style?: ModelerElementStyle
}

export type ModelerElementInput<TData extends Record<string, unknown> = Record<string, unknown>> =
  Partial<ModelerElement<TData>> & Pick<ModelerElement<TData>, 'id'>
