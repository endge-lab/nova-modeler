import type {
  BpmnValidationRuleId,
  ModelerElement,
  ModelerValidationIssue,
  ModelerValidationResult,
  ModelerValidationSeverity,
  ModelerModel,
} from '@/domain/types/index'
import { BPMN_EVENT_TYPE } from '@/elements/bpmn/event/bpmn-event.factory'
import { BPMN_BOUNDARY_EVENT_TYPE } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import {
  BPMN_FLOW_TYPE,
  normalizeBpmnFlowType,
} from '@/elements/bpmn/flow/bpmn-flow.factory'
import { BPMN_GATEWAY_TYPE } from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import { BPMN_SUB_PROCESS_TYPE } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import { BPMN_TASK_TYPE } from '@/elements/bpmn/task/bpmn-task.factory'
import type { BpmnEventElement } from '@/elements/bpmn/event/bpmn-event.types'
import type { BpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.types'
import type { BpmnTaskElement } from '@/elements/bpmn/task/bpmn-task.types'

export class BpmnValidationRuntime {
  static validate(model: ModelerModel): ModelerValidationResult {
    const issues: Array<ModelerValidationIssue> = []
    const elementsById = new Map(model.elements.map(element => [element.id, element]))
    const bpmnNodes = model.elements.filter(isBpmnNodeElement)
    const bpmnFlows = model.elements.filter(isBpmnFlowElement)
    const incoming = new Map<string, number>()
    const outgoing = new Map<string, number>()
    const defaultFlowsBySource = new Map<string, Array<BpmnFlowElement>>()

    for (const node of bpmnNodes) {
      incoming.set(node.id, 0)
      outgoing.set(node.id, 0)
    }

    for (const flow of bpmnFlows) {
      const sourceId = flow.source.elementId
      const targetId = flow.target.elementId
      const source = sourceId ? elementsById.get(sourceId) : undefined
      const target = targetId ? elementsById.get(targetId) : undefined
      const validSourceNode = !!source && isBpmnNodeElement(source)
      const validTargetNode = !!target && isBpmnNodeElement(target)

      if (!sourceId || !source || !validSourceNode) {
        issues.push(createIssue(
          flow.id,
          'bpmn.invalidFlowSource',
          'error',
          source && !validSourceNode
            ? 'BPMN flow source must be a BPMN node.'
            : 'BPMN flow source must reference an existing BPMN node.',
          sourceId ? [flow.id, sourceId] : [flow.id],
        ))
      }
      if (!targetId || !target || !validTargetNode) {
        issues.push(createIssue(
          flow.id,
          'bpmn.invalidFlowTarget',
          'error',
          target && !validTargetNode
            ? 'BPMN flow target must be a BPMN node.'
            : 'BPMN flow target must reference an existing BPMN node.',
          targetId ? [flow.id, targetId] : [flow.id],
        ))
      }
      if (sourceId && targetId && sourceId === targetId) {
        issues.push(createIssue(flow.id, 'bpmn.flowToSelf', 'error', 'BPMN flow cannot connect a node to itself.', [flow.id, sourceId]))
      }
      if (validSourceNode && validTargetNode && sourceId !== targetId) {
        outgoing.set(sourceId!, (outgoing.get(sourceId!) ?? 0) + 1)
        incoming.set(targetId!, (incoming.get(targetId!) ?? 0) + 1)
      }
      const flowType = normalizeBpmnFlowType(flow.data?.flowType)
      if (flowType === 'defaultSequence' && sourceId) {
        const list = defaultFlowsBySource.get(sourceId) ?? []
        list.push(flow)
        defaultFlowsBySource.set(sourceId, list)
        if (source && !isDefaultOrConditionalFlowSource(source)) {
          issues.push(createIssue(flow.id, 'bpmn.invalidDefaultFlowSource', 'error', 'Default sequence flow can only start from an Activity or Gateway.', [flow.id, sourceId]))
        }
      }
      if (flowType === 'conditionalSequence') {
        if (sourceId && source && !isDefaultOrConditionalFlowSource(source)) {
          issues.push(createIssue(flow.id, 'bpmn.invalidConditionalFlowSource', 'error', 'Conditional sequence flow can only start from an Activity or Gateway.', [flow.id, sourceId]))
        }
        if (typeof flow.data?.conditionExpression !== 'string' || !flow.data.conditionExpression.trim()) {
          issues.push(createIssue(flow.id, 'bpmn.conditionalFlowNoCondition', 'warning', 'Conditional sequence flow should define a condition expression.', [flow.id]))
        }
      }
    }

    for (const [sourceId, flows] of defaultFlowsBySource) {
      if (flows.length <= 1) continue
      issues.push(createIssue(
        sourceId,
        'bpmn.multipleDefaultFlows',
        'error',
        'A BPMN node can have only one default outgoing sequence flow.',
        [sourceId, ...flows.map(flow => flow.id)],
      ))
    }

    if (bpmnNodes.length === 0) {
      issues.push(createIssue('model', 'bpmn.noNodes', 'error', 'BPMN diagram must contain at least one BPMN node.', []))
    }

    const startEvents = bpmnNodes.filter(isStartEvent)
    const endEvents = bpmnNodes.filter(isEndEvent)
    if (startEvents.length === 0) {
      issues.push(createIssue('model', 'bpmn.noStartEvent', 'error', 'BPMN diagram must contain at least one Start Event.', []))
    }
    if (endEvents.length === 0) {
      issues.push(createIssue('model', 'bpmn.noEndEvent', 'error', 'BPMN diagram must contain at least one End Event.', []))
    }

    for (const node of bpmnNodes) {
      const incomingCount = incoming.get(node.id) ?? 0
      const outgoingCount = outgoing.get(node.id) ?? 0
      if (isStartEvent(node)) {
        if (incomingCount > 0) {
          issues.push(createIssue(node.id, 'bpmn.startIncoming', 'error', 'Start Event must not have incoming sequence flows.', [node.id]))
        }
        if (outgoingCount === 0) {
          issues.push(createIssue(node.id, 'bpmn.startNoOutgoing', 'error', 'Start Event must have at least one outgoing sequence flow.', [node.id]))
        }
        continue
      }
      if (isEndEvent(node)) {
        if (outgoingCount > 0) {
          issues.push(createIssue(node.id, 'bpmn.endOutgoing', 'error', 'End Event must not have outgoing sequence flows.', [node.id]))
        }
        if (incomingCount === 0) {
          issues.push(createIssue(node.id, 'bpmn.endNoIncoming', 'error', 'End Event must have at least one incoming sequence flow.', [node.id]))
        }
        continue
      }
      if (node.type === BPMN_BOUNDARY_EVENT_TYPE) {
        if (incomingCount > 0) {
          issues.push(createIssue(node.id, 'bpmn.invalidFlowTarget', 'error', 'Boundary Event must not have incoming sequence flows.', [node.id]))
        }
        continue
      }
      if ((isBpmnActivityElement(node) || node.type === BPMN_GATEWAY_TYPE) && incomingCount === 0) {
        issues.push(createIssue(node.id, 'bpmn.nodeNoIncoming', 'error', 'BPMN Task or Gateway must have at least one incoming sequence flow.', [node.id]))
      }
      if ((isBpmnActivityElement(node) || node.type === BPMN_GATEWAY_TYPE) && outgoingCount === 0) {
        issues.push(createIssue(node.id, 'bpmn.nodeNoOutgoing', 'error', 'BPMN Task or Gateway must have at least one outgoing sequence flow.', [node.id]))
      }
      if (node.type === BPMN_TASK_TYPE) {
        const task = node as BpmnTaskElement
        if (task.data?.instantiate && task.data.taskType !== 'receive') {
          issues.push(createIssue(node.id, 'bpmn.instantiateNonReceiveTask', 'error', 'Instantiate marker is only valid for Receive Task.', [node.id]))
        }
      }
    }

    const hasErrors = issues.some(issue => issue.severity === 'error')
    return {
      status: hasErrors ? 'invalid' : 'valid',
      modelVersion: model.version,
      issues,
    }
  }
}

function isBpmnNodeElement(element: ModelerElement): boolean {
  return element.type === BPMN_EVENT_TYPE || element.type === BPMN_BOUNDARY_EVENT_TYPE || isBpmnActivityElement(element) || element.type === BPMN_GATEWAY_TYPE
}

function isBpmnActivityElement(element: ModelerElement): boolean {
  return element.type === BPMN_TASK_TYPE || element.type === BPMN_SUB_PROCESS_TYPE || element.type === BPMN_CALL_ACTIVITY_TYPE
}

function isDefaultOrConditionalFlowSource(element: ModelerElement): boolean {
  return isBpmnActivityElement(element) || element.type === BPMN_GATEWAY_TYPE
}

function isBpmnFlowElement(element: ModelerElement): element is BpmnFlowElement {
  return element.type === BPMN_FLOW_TYPE
}

function isStartEvent(element: ModelerElement): element is BpmnEventElement {
  return element.type === BPMN_EVENT_TYPE && (element as BpmnEventElement).data?.eventPosition === 'start'
}

function isEndEvent(element: ModelerElement): element is BpmnEventElement {
  return element.type === BPMN_EVENT_TYPE && (element as BpmnEventElement).data?.eventPosition === 'end'
}

function createIssue(
  subjectId: string,
  ruleId: BpmnValidationRuleId,
  severity: ModelerValidationSeverity,
  message: string,
  elementIds: Array<string>,
): ModelerValidationIssue {
  return {
    id: `${ruleId}:${subjectId}`,
    ruleId,
    severity,
    message,
    elementIds,
  }
}
