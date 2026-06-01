import type { ModelerElementDefinition } from '@/domain/types'
import {
  BpmnActivityVariantProvider,
  resolveBpmnActivityVariantData as resolveBpmnTaskVariantData,
  resolveBpmnTaskTypeIcon,
} from '@/elements/bpmn/activity/bpmn-activity.variants'
import type { BpmnTaskElement } from '@/elements/bpmn/task/bpmn-task.types'

export type { BpmnActivityVariantData as BpmnTaskVariantData } from '@/elements/bpmn/activity/bpmn-activity.variants'

export const BpmnTaskVariantProvider = BpmnActivityVariantProvider as ModelerElementDefinition<BpmnTaskElement>['variantProvider']

export {
  resolveBpmnTaskTypeIcon,
  resolveBpmnTaskVariantData,
}
