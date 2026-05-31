import type {
  ModelerElement,
  ModelerPort,
} from '@/domain/types/index'

export function createBasicRectPorts(element: ModelerElement): Array<ModelerPort> {
  return [
    {
      id: 'top',
      elementId: element.id,
      side: 'top',
      x: element.x + element.width / 2,
      y: element.y,
    },
    {
      id: 'right',
      elementId: element.id,
      side: 'right',
      x: element.x + element.width,
      y: element.y + element.height / 2,
    },
    {
      id: 'bottom',
      elementId: element.id,
      side: 'bottom',
      x: element.x + element.width / 2,
      y: element.y + element.height,
    },
    {
      id: 'left',
      elementId: element.id,
      side: 'left',
      x: element.x,
      y: element.y + element.height / 2,
    },
  ]
}
