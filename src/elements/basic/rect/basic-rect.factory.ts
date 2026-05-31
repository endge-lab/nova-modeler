import type {
  ModelerElement,
  ModelerElementInput,
} from '@/domain/types/index'

export const BASIC_RECT_TYPE = 'basic.rect'

export const BASIC_RECT_DEFAULT_WIDTH = 160
export const BASIC_RECT_DEFAULT_HEIGHT = 96
export const BASIC_RECT_MIN_WIDTH = 24
export const BASIC_RECT_MIN_HEIGHT = 24

export function createBasicRectElement(input: ModelerElementInput): ModelerElement {
  return {
    id: input.id,
    type: BASIC_RECT_TYPE,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? BASIC_RECT_DEFAULT_WIDTH,
    height: input.height ?? BASIC_RECT_DEFAULT_HEIGHT,
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: input.data ?? {},
    style: input.style ? { ...input.style } : {},
  }
}
