import type {
  ModelerElement,
  ModelerExportContext,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { BPMN_EVENT_TYPE } from '@/elements/bpmn/event/bpmn-event.factory'
import type { BpmnEventElement } from '@/elements/bpmn/event/bpmn-event.types'
import { BPMN_FLOW_TYPE, normalizeBpmnFlowType } from '@/elements/bpmn/flow/bpmn-flow.factory'
import type { BpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.types'
import { BPMN_GATEWAY_TYPE, normalizeBpmnGatewayType } from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import type { BpmnGatewayElement } from '@/elements/bpmn/gateway/bpmn-gateway.types'
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import type { BpmnCallActivityElement } from '@/elements/bpmn/call-activity/bpmn-call-activity.types'
import { BPMN_SUB_PROCESS_TYPE, normalizeBpmnSubProcessType } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import type { BpmnSubProcessElement } from '@/elements/bpmn/sub-process/bpmn-sub-process.types'
import { BPMN_TASK_TYPE, normalizeBpmnTaskLoopType, normalizeBpmnTaskType } from '@/elements/bpmn/task/bpmn-task.factory'
import type { BpmnTaskElement } from '@/elements/bpmn/task/bpmn-task.types'
import { ModelerExportGeometry } from '@/model/export/modeler-export-geometry'

const BPMN_MIME_TYPE = 'application/xml;charset=utf-8'

interface BpmnExportState {
  processId: string
  diagramId: string
  planeId: string
  idByElement: Map<string, string>
  defaultFlowBySource: Map<string, string>
  geometry: ModelerExportGeometry
}

/**
 * Сериализует модель в строгий BPMN 2.0 XML с BPMN DI координатами.
 */
export class BpmnExporter {
  /**
   * Создает XML-строку BPMN definitions.
   */
  export(context: ModelerExportContext): string {
    const state = this.createState(context)
    const processItems = context.model.elements
      .filter(element => !isModelerEdgeElement(element))
      .map(element => this.serializeNode(element, state))
    const flowItems = context.model.elements
      .filter((element): element is BpmnFlowElement => element.type === BPMN_FLOW_TYPE && isModelerEdgeElement(element))
      .map(element => this.serializeFlow(element, state))
    const diagramItems = context.model.elements.map(element => this.serializeDiagramElement(context, element, state))
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="https://endge.dev/nova-modeler">',
      `  <process id="${state.processId}" isExecutable="false">`,
      ...processItems.map(item => indent(item, 4)),
      ...flowItems.map(item => indent(item, 4)),
      '  </process>',
      `  <bpmndi:BPMNDiagram id="${state.diagramId}">`,
      `    <bpmndi:BPMNPlane id="${state.planeId}" bpmnElement="${state.processId}">`,
      ...diagramItems.map(item => indent(item, 6)),
      '    </bpmndi:BPMNPlane>',
      '  </bpmndi:BPMNDiagram>',
      '</definitions>',
    ].join('\n')
  }

  /**
   * Создает скачиваемый BPMN Blob.
   */
  exportBlob(context: ModelerExportContext): Blob {
    return new Blob([this.export(context)], { type: BPMN_MIME_TYPE })
  }

  private createState(context: ModelerExportContext): BpmnExportState {
    const processId = toBpmnId('Process', context.model.id)
    const idByElement = new Map<string, string>()
    for (const element of context.model.elements) {
      idByElement.set(element.id, toBpmnElementId(element))
    }
    const defaultFlowBySource = new Map<string, string>()
    for (const element of context.model.elements) {
      if (element.type !== BPMN_FLOW_TYPE || !isModelerEdgeElement(element)) continue
      if (normalizeBpmnFlowType(element.data?.flowType) !== 'defaultSequence') continue
      const sourceId = element.source.elementId
      if (sourceId) defaultFlowBySource.set(sourceId, idByElement.get(element.id) ?? toBpmnElementId(element))
    }
    return {
      processId,
      diagramId: `${processId}_Diagram`,
      planeId: `${processId}_Plane`,
      idByElement,
      defaultFlowBySource,
      geometry: new ModelerExportGeometry(),
    }
  }

  private serializeNode(element: ModelerElement, state: BpmnExportState): string {
    if (element.type === BPMN_TASK_TYPE) return this.serializeTask(element as BpmnTaskElement, state)
    if (element.type === BPMN_SUB_PROCESS_TYPE) return this.serializeSubProcess(element as BpmnSubProcessElement, state)
    if (element.type === BPMN_CALL_ACTIVITY_TYPE) return this.serializeCallActivity(element as BpmnCallActivityElement, state)
    if (element.type === BPMN_EVENT_TYPE) return this.serializeEvent(element as BpmnEventElement, state)
    if (element.type === BPMN_GATEWAY_TYPE) return this.serializeGateway(element as BpmnGatewayElement, state)
    throw new Error(`[BpmnExporter] Unsupported BPMN element type: ${element.type}`)
  }

  private serializeTask(element: BpmnTaskElement, state: BpmnExportState): string {
    const type = normalizeBpmnTaskType(element.data?.taskType)
    const tag = type === 'user'
      ? 'userTask'
      : type === 'manual'
        ? 'manualTask'
        : type === 'service'
          ? 'serviceTask'
          : type === 'script'
            ? 'scriptTask'
            : type === 'businessRule'
              ? 'businessRuleTask'
              : type === 'send'
                ? 'sendTask'
                : type === 'receive'
                  ? 'receiveTask'
                  : 'task'
    const attrs = this.serializeNodeAttrs(element, state)
    const taskAttrs = [
      attrs,
      element.data?.isForCompensation ? 'isForCompensation="true"' : '',
      tag === 'receiveTask' && element.data?.instantiate ? 'instantiate="true"' : '',
    ].filter(Boolean).join(' ')
    const children = this.serializeTaskChildren(element)
    return children.length > 0
      ? [`<${tag} ${taskAttrs}>`, ...children.map(item => indent(item, 2)), `</${tag}>`].join('\n')
      : `<${tag} ${taskAttrs} />`
  }

  private serializeTaskChildren(element: BpmnTaskElement): Array<string> {
    const loopType = normalizeBpmnTaskLoopType(element.data?.loopType)
    if (loopType === 'standard') return ['<standardLoopCharacteristics />']
    if (loopType === 'multiInstanceParallel') return ['<multiInstanceLoopCharacteristics isSequential="false" />']
    if (loopType === 'multiInstanceSequential') return ['<multiInstanceLoopCharacteristics isSequential="true" />']
    return []
  }

  private serializeSubProcess(element: BpmnSubProcessElement, state: BpmnExportState): string {
    const type = normalizeBpmnSubProcessType(element.data?.subProcessType)
    const tag = type === 'transaction'
      ? 'transaction'
      : type === 'adHoc'
        ? 'adHocSubProcess'
        : 'subProcess'
    const attrs = [
      this.serializeNodeAttrs(element, state),
      type === 'event' ? 'triggeredByEvent="true"' : '',
      element.data?.isForCompensation ? 'isForCompensation="true"' : '',
    ].filter(Boolean).join(' ')
    const children = this.serializeActivityLoopChildren(element)
    return children.length > 0
      ? [`<${tag} ${attrs}>`, ...children.map(item => indent(item, 2)), `</${tag}>`].join('\n')
      : `<${tag} ${attrs} />`
  }

  private serializeCallActivity(element: BpmnCallActivityElement, state: BpmnExportState): string {
    const attrs = [
      this.serializeNodeAttrs(element, state),
      element.data?.isForCompensation ? 'isForCompensation="true"' : '',
    ].filter(Boolean).join(' ')
    const children = this.serializeActivityLoopChildren(element)
    return children.length > 0
      ? [`<callActivity ${attrs}>`, ...children.map(item => indent(item, 2)), '</callActivity>'].join('\n')
      : `<callActivity ${attrs} />`
  }

  private serializeActivityLoopChildren(element: BpmnTaskElement | BpmnSubProcessElement | BpmnCallActivityElement): Array<string> {
    const loopType = normalizeBpmnTaskLoopType(element.data?.loopType)
    if (loopType === 'standard') return ['<standardLoopCharacteristics />']
    if (loopType === 'multiInstanceParallel') return ['<multiInstanceLoopCharacteristics isSequential="false" />']
    if (loopType === 'multiInstanceSequential') return ['<multiInstanceLoopCharacteristics isSequential="true" />']
    return []
  }

  private serializeEvent(element: BpmnEventElement, state: BpmnExportState): string {
    const position = element.data?.eventPosition ?? 'start'
    const direction = element.data?.direction ?? (position === 'end' ? 'throw' : 'catch')
    const tag = position === 'start'
      ? 'startEvent'
      : position === 'end'
        ? 'endEvent'
        : direction === 'throw'
          ? 'intermediateThrowEvent'
          : 'intermediateCatchEvent'
    const attrs = this.serializeNodeAttrs(element, state)
    const eventDefinition = this.serializeEventDefinition(element)
    return eventDefinition
      ? [`<${tag} ${attrs}>`, `  ${eventDefinition}`, `</${tag}>`].join('\n')
      : `<${tag} ${attrs} />`
  }

  private serializeEventDefinition(element: BpmnEventElement): string {
    const trigger = element.data?.trigger ?? 'none'
    if (trigger === 'message') return '<messageEventDefinition />'
    if (trigger === 'timer') return '<timerEventDefinition />'
    if (trigger === 'error') return '<errorEventDefinition />'
    if (trigger === 'escalation') return '<escalationEventDefinition />'
    if (trigger === 'cancel') return '<cancelEventDefinition />'
    if (trigger === 'compensation') return '<compensateEventDefinition />'
    if (trigger === 'conditional') return '<conditionalEventDefinition />'
    if (trigger === 'link') return '<linkEventDefinition />'
    if (trigger === 'signal') return '<signalEventDefinition />'
    if (trigger === 'terminate') return '<terminateEventDefinition />'
    if (trigger === 'multiple') return '<multipleEventDefinition />'
    if (trigger === 'parallelMultiple') return '<parallelMultipleEventDefinition />'
    return ''
  }

  private serializeGateway(element: BpmnGatewayElement, state: BpmnExportState): string {
    const type = normalizeBpmnGatewayType(element.data?.gatewayType)
    const tag = type === 'parallel'
      ? 'parallelGateway'
      : type === 'inclusive'
        ? 'inclusiveGateway'
        : type === 'complex'
          ? 'complexGateway'
          : type === 'eventBased' || type === 'parallelEventBased'
            ? 'eventBasedGateway'
            : 'exclusiveGateway'
    const parallelAttr = type === 'parallelEventBased' ? ' eventGatewayType="Parallel"' : ''
    return `<${tag} ${this.serializeNodeAttrs(element, state)}${parallelAttr} />`
  }

  private serializeNodeAttrs(element: ModelerElement, state: BpmnExportState): string {
    const attrs = [
      `id="${this.requireBpmnId(element, state)}"`,
      this.resolveName(element) ? `name="${escapeXml(this.resolveName(element))}"` : '',
      state.defaultFlowBySource.has(element.id) ? `default="${state.defaultFlowBySource.get(element.id)}"` : '',
    ]
    return attrs.filter(Boolean).join(' ')
  }

  private serializeFlow(element: BpmnFlowElement, state: BpmnExportState): string {
    const sourceRef = this.resolveEndpointRef(element.source.elementId, state)
    const targetRef = this.resolveEndpointRef(element.target.elementId, state)
    const id = this.requireBpmnId(element, state)
    const flowType = normalizeBpmnFlowType(element.data?.flowType)
    const attrs = `id="${id}" sourceRef="${sourceRef}" targetRef="${targetRef}"`
    if (flowType !== 'conditionalSequence') return `<sequenceFlow ${attrs} />`
    return [
      `<sequenceFlow ${attrs}>`,
      '  <conditionExpression xsi:type="tFormalExpression">true</conditionExpression>',
      '</sequenceFlow>',
    ].join('\n')
  }

  private serializeDiagramElement(context: ModelerExportContext, element: ModelerElement, state: BpmnExportState): string {
    const id = this.requireBpmnId(element, state)
    if (isModelerEdgeElement(element)) {
      const path = state.geometry.resolveEdgePath(context.model, element, context.pluginContext)
      return [
        `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">`,
        ...path.map(point => `  <di:waypoint x="${round(point.x)}" y="${round(point.y)}" />`),
        '</bpmndi:BPMNEdge>',
      ].join('\n')
    }
    return [
      `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">`,
      `  <dc:Bounds x="${round(element.x)}" y="${round(element.y)}" width="${round(element.width)}" height="${round(element.height)}" />`,
      '</bpmndi:BPMNShape>',
    ].join('\n')
  }

  private resolveName(element: ModelerElement): string {
    if (typeof element.data?.name === 'string') return element.data.name
    return ''
  }

  private resolveEndpointRef(elementId: string | undefined, state: BpmnExportState): string {
    if (!elementId) throw new Error('[BpmnExporter] BPMN flow endpoint must reference an element.')
    const ref = state.idByElement.get(elementId)
    if (!ref) throw new Error(`[BpmnExporter] BPMN flow endpoint references missing element: ${elementId}`)
    return ref
  }

  private requireBpmnId(element: ModelerElement, state: BpmnExportState): string {
    const id = state.idByElement.get(element.id)
    if (!id) throw new Error(`[BpmnExporter] Missing BPMN id for element: ${element.id}`)
    return id
  }
}

function toBpmnElementId(element: ModelerElement): string {
  const prefix = element.type === BPMN_TASK_TYPE
    ? 'Task'
    : element.type === BPMN_EVENT_TYPE
      ? 'Event'
      : element.type === BPMN_GATEWAY_TYPE
        ? 'Gateway'
        : element.type === BPMN_FLOW_TYPE
          ? 'Flow'
          : 'Element'
  return toBpmnId(prefix, element.id)
}

function toBpmnId(prefix: string, value: string): string {
  const safe = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, '_')
    .replace(/^[^A-Za-z_]+/, '')
  return `${prefix}_${safe || '1'}`
}

function indent(value: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return value.split('\n').map(line => `${pad}${line}`).join('\n')
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
