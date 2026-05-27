import type {
  ProcessEdge,
  ProcessModel,
  ProcessNode,
  ProcessValidationIssue,
} from '@/model/types/process-modeler.types'
import {
  areProcessPortsCompatible,
  findProcessNodePort,
  isProcessPortCapacityExceeded,
  resolveProcessEdgePortIds,
  resolveProcessNodePortDefinitions,
} from '@/model/ports/process-ports'

/** Валидирует BPMN-compatible process-модель v1. */
export function validateProcessModel(model: ProcessModel): Array<ProcessValidationIssue> {
  return [
    ...validateDuplicateIds(model),
    ...validateStartEnd(model),
    ...validateEdges(model),
    ...validatePorts(model),
    ...validateOrphans(model),
    ...validateGateways(model),
    ...model.issues.filter(issue => issue.code === 'unsupported'),
  ]
}

function validatePorts(model: ProcessModel): Array<ProcessValidationIssue> {
  const issues: Array<ProcessValidationIssue> = []
  const nodesById = new Map(model.nodes.map(node => [node.id, node]))
  const portCounts = countPortConnections(model)

  for (const edge of model.edges) {
    const source = nodesById.get(edge.sourceId)
    const target = nodesById.get(edge.targetId)
    if (!source || !target) continue

    const portIds = resolveProcessEdgePortIds(source, target, edge)
    const sourcePort = findProcessNodePort(source, portIds.sourcePortId, 'output')
    const targetPort = findProcessNodePort(target, portIds.targetPortId, 'input')

    if (!sourcePort || !targetPort || !areProcessPortsCompatible(sourcePort, targetPort, edge.kind)) {
      issues.push({
        code: 'invalid-port',
        severity: 'error',
        elementId: edge.id,
        message: `Связь "${edge.id}" использует несовместимые connection ports.`,
        details: { sourcePortId: portIds.sourcePortId, targetPortId: portIds.targetPortId },
      })
      continue
    }

    const sourceCount = portCounts.get(`${source.id}:${sourcePort.id}`)!
    const targetCount = portCounts.get(`${target.id}:${targetPort.id}`)!
    if (isProcessPortCapacityExceeded(sourcePort, sourceCount) || isProcessPortCapacityExceeded(targetPort, targetCount)) {
      issues.push({
        code: 'invalid-port',
        severity: 'error',
        elementId: edge.id,
        message: `Связь "${edge.id}" превышает capacity одного из connection ports.`,
        details: { sourcePortId: sourcePort.id, targetPortId: targetPort.id },
      })
    }
  }

  return issues
}

function validateDuplicateIds(model: ProcessModel): Array<ProcessValidationIssue> {
  const issues: Array<ProcessValidationIssue> = []
  const ids = new Map<string, number>()

  for (const id of collectIds(model)) ids.set(id, (ids.get(id) ?? 0) + 1)

  for (const [id, count] of ids) {
    if (count <= 1) continue
    issues.push({
      code: 'duplicate-id',
      severity: 'error',
      elementId: id,
      message: `Элемент "${id}" встречается несколько раз.`,
    })
  }

  return issues
}

function validateStartEnd(model: ProcessModel): Array<ProcessValidationIssue> {
  const issues: Array<ProcessValidationIssue> = []
  if (!model.nodes.some(node => node.kind === 'startEvent')) {
    issues.push({ code: 'missing-start', severity: 'error', message: 'В процессе должен быть хотя бы один start event.' })
  }
  if (!model.nodes.some(node => node.kind === 'endEvent')) {
    issues.push({ code: 'missing-end', severity: 'error', message: 'В процессе должен быть хотя бы один end event.' })
  }
  return issues
}

function validateEdges(model: ProcessModel): Array<ProcessValidationIssue> {
  const issues: Array<ProcessValidationIssue> = []
  const nodeIds = new Set(model.nodes.map(node => node.id))

  for (const edge of model.edges) {
    if (!edge.sourceId || !edge.targetId) {
      issues.push({
        code: 'dangling-edge',
        severity: 'error',
        elementId: edge.id,
        message: `Связь "${edge.id}" не содержит source или target.`,
      })
      continue
    }
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) {
      issues.push({
        code: 'invalid-edge-target',
        severity: 'error',
        elementId: edge.id,
        message: `Связь "${edge.id}" указывает на отсутствующий элемент.`,
        details: { sourceId: edge.sourceId, targetId: edge.targetId },
      })
    }
  }

  return issues
}

function validateOrphans(model: ProcessModel): Array<ProcessValidationIssue> {
  const issues: Array<ProcessValidationIssue> = []
  const incoming = countEdges(model.edges, 'targetId')
  const outgoing = countEdges(model.edges, 'sourceId')

  for (const node of model.nodes) {
    if (node.kind === 'startEvent') {
      /* v8 ignore next -- covered behaviorally by missing-start/missing-flow cases, but V8 keeps the nullish branch sticky here. */
      if ((outgoing.get(node.id) ?? 0) === 0) issues.push(orphan(node, 'Start event должен вести дальше по процессу.'))
      continue
    }
    if (node.kind === 'endEvent') {
      if ((incoming.get(node.id) ?? 0) === 0) issues.push(orphan(node, 'End event должен иметь входящий переход.'))
      continue
    }
    if ((incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id) ?? 0) === 0) {
      issues.push(orphan(node, `Элемент "${node.id}" не подключен к процессу.`))
    }
  }

  return issues
}

function validateGateways(model: ProcessModel): Array<ProcessValidationIssue> {
  const issues: Array<ProcessValidationIssue> = []
  const incoming = countEdges(model.edges, 'targetId')
  const outgoing = countEdges(model.edges, 'sourceId')

  for (const node of model.nodes) {
    if (node.kind !== 'exclusiveGateway' && node.kind !== 'parallelGateway') continue
    const inCount = incoming.get(node.id) ?? 0
    const outCount = outgoing.get(node.id) ?? 0
    if (inCount === 0 || outCount < 2) {
      issues.push({
        code: 'invalid-gateway',
        severity: 'warning',
        elementId: node.id,
        message: `Gateway "${node.id}" должен иметь входящий переход и минимум два исходящих перехода.`,
        details: { incoming: inCount, outgoing: outCount },
      })
    }
  }

  return issues
}

function collectIds(model: ProcessModel): Array<string> {
  return [
    model.id,
    ...model.nodes.map(node => node.id),
    ...model.edges.map(edge => edge.id),
    ...model.pools.flatMap(pool => [pool.id, ...pool.lanes.map(lane => lane.id)]),
  ]
}

function countEdges(edges: Array<ProcessEdge>, field: 'sourceId' | 'targetId'): Map<string, number> {
  const result = new Map<string, number>()
  for (const edge of edges) result.set(edge[field], (result.get(edge[field]) ?? 0) + 1)
  return result
}

function countPortConnections(model: ProcessModel): Map<string, number> {
  const result = new Map<string, number>()
  const nodesById = new Map(model.nodes.map(node => [node.id, node]))

  for (const node of model.nodes) {
    for (const port of resolveProcessNodePortDefinitions(node)) {
      result.set(`${node.id}:${port.id}`, 0)
    }
  }

  for (const edge of model.edges) {
    const source = nodesById.get(edge.sourceId)
    const target = nodesById.get(edge.targetId)
    if (!source || !target) continue
    const portIds = resolveProcessEdgePortIds(source, target, edge)
    if (portIds.sourcePortId) increment(result, `${source.id}:${portIds.sourcePortId}`)
    if (portIds.targetPortId) increment(result, `${target.id}:${portIds.targetPortId}`)
  }

  return result
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function orphan(node: ProcessNode, message: string): ProcessValidationIssue {
  return {
    code: 'orphan-node',
    severity: 'warning',
    elementId: node.id,
    message,
  }
}
