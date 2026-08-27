import type { ModelerElementDefinition } from '@/domain/types'
import type { BpmnTaskElement } from '@/elements/bpmn/task/bpmn-task.types'
import {
  BpmnActivityVariantProvider,
  resolveBpmnTaskTypeIcon,
  resolveBpmnActivityVariantData as resolveBpmnTaskVariantData,
} from '@/elements/bpmn/activity/bpmn-activity.variants'

export type { BpmnActivityVariantData as BpmnTaskVariantData } from '@/elements/bpmn/activity/bpmn-activity.variants'

export const BpmnTaskVariantProvider = BpmnActivityVariantProvider as ModelerElementDefinition<BpmnTaskElement>['variantProvider']

export {
  resolveBpmnTaskTypeIcon,
  resolveBpmnTaskVariantData,
}
