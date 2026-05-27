import type {
  ProcessEdge,
  ProcessModel,
  ProcessModelInput,
  ProcessNode,
  ProcessNodeKind,
  ProcessValidationIssue,
} from '@/model/types/process-modeler.types'
import { createProcessModel } from '@/model/store/process-model'

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI'
const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC'
const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI'
const SUPPORTED_NODE_TAGS: Record<string, ProcessNodeKind> = {
  startEvent: 'startEvent',
  endEvent: 'endEvent',
  userTask: 'userTask',
  serviceTask: 'serviceTask',
  exclusiveGateway: 'exclusiveGateway',
  parallelGateway: 'parallelGateway',
}

/** Импортирует ограниченный BPMN 2.0 XML в внутреннюю process-модель. */
export function importBpmnXml(xml: string): ProcessModel {
  const document = parseXml(xml)
  const process = firstByLocalName(document, 'process')
  const nodes = collectNodes(document)
  const edges = collectEdges(document)
  const issues = collectUnsupportedIssues(document)

  return createProcessModel({
    id: process?.getAttribute('id') ?? undefined,
    metadata: { name: process?.getAttribute('name') ?? undefined },
    nodes,
    edges,
    issues,
  })
}

/** Экспортирует внутреннюю process-модель в ограниченный BPMN 2.0 XML. */
export function exportBpmnXml(model: ProcessModel): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<bpmn:definitions xmlns:bpmn="${BPMN_NS}" xmlns:bpmndi="${BPMNDI_NS}" xmlns:dc="${DC_NS}" xmlns:di="${DI_NS}" id="${escapeXml(model.id)}-definitions">`,
    `  <bpmn:process id="${escapeXml(model.id)}" name="${escapeXml(model.metadata.name ?? 'Process')}" isExecutable="false">`,
    ...model.nodes.map(exportNode),
    ...model.edges.map(exportEdge),
    '  </bpmn:process>',
    `  <bpmndi:BPMNDiagram id="${escapeXml(model.id)}-diagram">`,
    `    <bpmndi:BPMNPlane id="${escapeXml(model.id)}-plane" bpmnElement="${escapeXml(model.id)}">`,
    ...model.nodes.map(exportNodeShape),
    ...model.edges.map(exportEdgeShape),
    '    </bpmndi:BPMNPlane>',
    '  </bpmndi:BPMNDiagram>',
    '</bpmn:definitions>',
  ]
  return `${lines.join('\n')}\n`
}

function parseXml(xml: string): Document {
  const parser = new DOMParser()
  const document = parser.parseFromString(xml, 'application/xml')
  if (firstByLocalName(document, 'parsererror')) {
    throw new Error('Invalid BPMN XML.')
  }
  return document
}

function collectNodes(document: Document): ProcessModelInput['nodes'] {
  const boundsById = collectBounds(document)
  const nodes: ProcessModelInput['nodes'] = []

  for (const [tag, kind] of Object.entries(SUPPORTED_NODE_TAGS)) {
    for (const element of byLocalName(document, tag)) {
      const id = requiredId(element, tag)
      const bounds = boundsById.get(id)
      nodes.push({
        id,
        kind,
        x: bounds?.x ?? 0,
        y: bounds?.y ?? nodes.length * 96,
        width: bounds?.width,
        height: bounds?.height,
        metadata: { name: attr(element, 'name') },
      })
    }
  }

  return nodes
}

function collectEdges(document: Document): Array<Partial<ProcessEdge> & Pick<ProcessEdge, 'id' | 'sourceId' | 'targetId'>> {
  return byLocalName(document, 'sequenceFlow').map(element => ({
    id: requiredId(element, 'sequenceFlow'),
    sourceId: attr(element, 'sourceRef') ?? '',
    targetId: attr(element, 'targetRef') ?? '',
    metadata: {
      name: attr(element, 'name'),
      condition: textOf(firstChildByLocalName(element, 'conditionExpression')),
    },
  }))
}

function collectUnsupportedIssues(document: Document): Array<ProcessValidationIssue> {
  const supported = new Set([...Object.keys(SUPPORTED_NODE_TAGS), 'sequenceFlow', 'process', 'definitions', 'documentation'])
  const issues: Array<ProcessValidationIssue> = []
  const processChildren = Array.from((firstByLocalName(document, 'process') ?? document.createElement('process')).children)

  for (const child of processChildren) {
    const tag = child.localName
    if (supported.has(tag)) continue
    issues.push({
      code: 'unsupported',
      severity: 'info',
      elementId: child.getAttribute('id') ?? undefined,
      message: `BPMN element "${tag}" пока не поддерживается профилем v1.`,
      details: { tag },
    })
  }

  return issues
}

function collectBounds(document: Document): Map<string, { x: number; y: number; width: number; height: number }> {
  const result = new Map<string, { x: number; y: number; width: number; height: number }>()
  for (const shape of byLocalName(document, 'BPMNShape')) {
    const id = attr(shape, 'bpmnElement')
    const bounds = firstChildByLocalName(shape, 'Bounds')
    if (!id || !bounds) continue
    result.set(id, {
      x: numberAttr(bounds, 'x', 0),
      y: numberAttr(bounds, 'y', 0),
      width: numberAttr(bounds, 'width', 120),
      height: numberAttr(bounds, 'height', 72),
    })
  }
  return result
}

function exportNode(node: ProcessNode): string {
  const name = node.metadata.name ? ` name="${escapeXml(node.metadata.name)}"` : ''
  return `    <bpmn:${node.kind} id="${escapeXml(node.id)}"${name} />`
}

function exportEdge(edge: ProcessEdge): string {
  const name = edge.metadata.name ? ` name="${escapeXml(edge.metadata.name)}"` : ''
  if (!edge.metadata.condition) {
    return `    <bpmn:sequenceFlow id="${escapeXml(edge.id)}" sourceRef="${escapeXml(edge.sourceId)}" targetRef="${escapeXml(edge.targetId)}"${name} />`
  }
  return [
    `    <bpmn:sequenceFlow id="${escapeXml(edge.id)}" sourceRef="${escapeXml(edge.sourceId)}" targetRef="${escapeXml(edge.targetId)}"${name}>`,
    `      <bpmn:conditionExpression>${escapeXml(edge.metadata.condition)}</bpmn:conditionExpression>`,
    '    </bpmn:sequenceFlow>',
  ].join('\n')
}

function exportNodeShape(node: ProcessNode): string {
  return [
    `      <bpmndi:BPMNShape id="${escapeXml(node.id)}-shape" bpmnElement="${escapeXml(node.id)}">`,
    `        <dc:Bounds x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" />`,
    '      </bpmndi:BPMNShape>',
  ].join('\n')
}

function exportEdgeShape(edge: ProcessEdge): string {
  return [
    `      <bpmndi:BPMNEdge id="${escapeXml(edge.id)}-edge" bpmnElement="${escapeXml(edge.id)}">`,
    '        <di:waypoint x=\'0\' y=\'0\' />',
    '        <di:waypoint x=\'80\' y=\'0\' />',
    '      </bpmndi:BPMNEdge>',
  ].join('\n')
}

function byLocalName(root: ParentNode, localName: string): Array<Element> {
  return Array.from(root.querySelectorAll('*')).filter(element => element.localName === localName)
}

function firstByLocalName(root: ParentNode, localName: string): Element | undefined {
  return byLocalName(root, localName)[0]
}

function firstChildByLocalName(root: Element, localName: string): Element | undefined {
  return Array.from(root.children).find(element => element.localName === localName)
}

function requiredId(element: Element, fallback: string): string {
  return attr(element, 'id') ?? `${fallback}-${Math.random().toString(36).slice(2)}`
}

function attr(element: Element, name: string): string | undefined {
  return element.getAttribute(name) ?? undefined
}

function numberAttr(element: Element, name: string, fallback: number): number {
  const value = Number(element.getAttribute(name))
  return Number.isFinite(value) ? value : fallback
}

function textOf(element: Element | undefined): string | undefined {
  const text = element?.textContent?.trim()
  return text || undefined
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
