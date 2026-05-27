import type {
  LowCodeProcessGateway,
  LowCodeProcessManifest,
  LowCodeProcessTask,
  LowCodeProcessTransition,
  ProcessEdge,
  ProcessModel,
  ProcessNode,
} from '@/model/types/process-modeler.types'
import { validateProcessModel } from '@/model/validation/process-validation'

/** Компилирует process-модель в low-code manifest без исполнения workflow. */
export function compileLowCodeManifest(model: ProcessModel): LowCodeProcessManifest {
  const tasks = model.nodes.filter(isTask).map(toTask)
  const gateways = model.nodes.filter(isGateway).map(node => toGateway(node, model.edges))
  const transitions = model.edges.map(toTransition)

  return {
    id: model.id,
    version: model.version,
    name: model.metadata.name ?? model.id,
    tasks,
    gateways,
    transitions,
    forms: unique(tasks.map(task => task.formId).filter(isDefined)),
    actions: unique(tasks.map(task => task.actionId).filter(isDefined)),
    issues: validateProcessModel(model),
  }
}

function isTask(node: ProcessNode): node is ProcessNode & { kind: 'userTask' | 'serviceTask' } {
  return node.kind === 'userTask' || node.kind === 'serviceTask'
}

function isGateway(node: ProcessNode): node is ProcessNode & { kind: 'exclusiveGateway' | 'parallelGateway' } {
  return node.kind === 'exclusiveGateway' || node.kind === 'parallelGateway'
}

function toTask(node: ProcessNode & { kind: 'userTask' | 'serviceTask' }): LowCodeProcessTask {
  return {
    id: node.id,
    kind: node.kind,
    name: node.metadata.name ?? node.id,
    formId: node.metadata.formId,
    actionId: node.metadata.actionId,
    assignee: node.metadata.assignee,
    metadata: node.metadata,
  }
}

function toGateway(node: ProcessNode & { kind: 'exclusiveGateway' | 'parallelGateway' }, edges: Array<ProcessEdge>): LowCodeProcessGateway {
  return {
    id: node.id,
    kind: node.kind,
    name: node.metadata.name ?? node.id,
    incoming: edges.filter(edge => edge.targetId === node.id).map(edge => edge.id),
    outgoing: edges.filter(edge => edge.sourceId === node.id).map(edge => edge.id),
  }
}

function toTransition(edge: ProcessEdge): LowCodeProcessTransition {
  return {
    id: edge.id,
    from: edge.sourceId,
    to: edge.targetId,
    sourcePortId: edge.sourcePortId,
    targetPortId: edge.targetPortId,
    condition: edge.metadata.condition,
    metadata: edge.metadata,
  }
}

function unique(values: Array<string>): Array<string> {
  return Array.from(new Set(values))
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}
