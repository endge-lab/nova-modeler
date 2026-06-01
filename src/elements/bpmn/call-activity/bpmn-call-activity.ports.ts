import type { ModelerPort } from '@/domain/types/index'
import type { BpmnCallActivityElement } from '@/elements/bpmn/call-activity/bpmn-call-activity.types'

export function createBpmnCallActivityPorts(element: BpmnCallActivityElement): Array<ModelerPort> {
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
