import type {
  BpmnGlobalDefinition,
  BpmnGlobalDefinitionKind,
  ModelerElement,
  ModelerExportContext,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { BPMN_BOUNDARY_EVENT_TYPE } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import type { BpmnBoundaryEventElement } from '@/elements/bpmn/boundary-event/bpmn-boundary-event.types'
import { BPMN_DATA_OBJECT_TYPE } from '@/elements/bpmn/data/data-object/bpmn-data-object.factory'
import type { BpmnDataObjectElement } from '@/elements/bpmn/data/data-object/bpmn-data-object.types'
import { BPMN_DATA_STORE_TYPE } from '@/elements/bpmn/data/data-store/bpmn-data-store.factory'
import type { BpmnDataStoreElement } from '@/elements/bpmn/data/data-store/bpmn-data-store.types'
import {
  BPMN_DATA_ASSOCIATION_TYPE,
  normalizeBpmnDataAssociationType,
} from '@/elements/bpmn/data-association/bpmn-data-association.factory'
import type { BpmnDataAssociationElement } from '@/elements/bpmn/data-association/bpmn-data-association.types'
import { BPMN_EVENT_TYPE, normalizeBpmnEventVariantData } from '@/elements/bpmn/event/bpmn-event.factory'
import type { BpmnEventElement } from '@/elements/bpmn/event/bpmn-event.types'
import { BPMN_FLOW_TYPE, normalizeBpmnFlowType } from '@/elements/bpmn/flow/bpmn-flow.factory'
import type { BpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.types'
import { BPMN_GATEWAY_TYPE, normalizeBpmnGatewayType } from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import type { BpmnGatewayElement } from '@/elements/bpmn/gateway/bpmn-gateway.types'
import { BPMN_CALL_ACTIVITY_TYPE } from '@/elements/bpmn/call-activity/bpmn-call-activity.factory'
import type { BpmnCallActivityElement } from '@/elements/bpmn/call-activity/bpmn-call-activity.types'
import { BPMN_MESSAGE_FLOW_TYPE } from '@/elements/bpmn/message-flow/bpmn-message-flow.factory'
import type { BpmnMessageFlowElement } from '@/elements/bpmn/message-flow/bpmn-message-flow.types'
import { BPMN_PARTICIPANT_TYPE } from '@/elements/bpmn/participant/bpmn-participant.factory'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import { BPMN_SUB_PROCESS_TYPE, normalizeBpmnSubProcessType } from '@/elements/bpmn/sub-process/bpmn-sub-process.factory'
import type { BpmnSubProcessElement } from '@/elements/bpmn/sub-process/bpmn-sub-process.types'
import { BPMN_TASK_TYPE, normalizeBpmnTaskLoopType, normalizeBpmnTaskType } from '@/elements/bpmn/task/bpmn-task.factory'
import type { BpmnTaskElement } from '@/elements/bpmn/task/bpmn-task.types'
import { ModelerExportGeometry } from '@/model/export/modeler-export-geometry'
import {
  resolveBpmnGlobalDefinitionRefKey,
} from '@/model/bpmn-definitions'

const BPMN_MIME_TYPE = 'application/xml;charset=utf-8'

interface BpmnExportState {
  processId: string
  collaborationId: string
  diagramId: string
  planeId: string
  idByElement: Map<string, string>
  idByDefinition: Map<string, string>
  defaultFlowBySource: Map<string, string>
  dataAssociationsByActivity: Map<string, Array<BpmnDataAssociationElement>>
  linkCatchDefinitionByRef: Map<string, string>
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
      .filter(element => !isModelerEdgeElement(element) && element.type !== BPMN_PARTICIPANT_TYPE)
      .map(element => this.serializeNode(element, state))
    const definitionItems = context.model.bpmnDefinitions.map(definition => this.serializeGlobalDefinition(definition, state))
    const collaborationItems = this.serializeCollaborationItems(context, state)
    const planeElementId = collaborationItems.length > 0 ? state.collaborationId : state.processId
    const flowItems = context.model.elements
      .filter((element): element is BpmnFlowElement => element.type === BPMN_FLOW_TYPE && isModelerEdgeElement(element))
      .map(element => this.serializeFlow(element, state))
    const diagramItems = context.model.elements.map(element => this.serializeDiagramElement(context, element, state))
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="https://endge.dev/nova-modeler">',
      ...definitionItems.map(item => indent(item, 2)),
      ...collaborationItems.map(item => indent(item, 2)),
      `  <process id="${state.processId}" isExecutable="false">`,
      ...processItems.map(item => indent(item, 4)),
      ...flowItems.map(item => indent(item, 4)),
      '  </process>',
      `  <bpmndi:BPMNDiagram id="${state.diagramId}">`,
      `    <bpmndi:BPMNPlane id="${state.planeId}" bpmnElement="${planeElementId}">`,
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
    const idByDefinition = new Map<string, string>()
    for (const element of context.model.elements) {
      idByElement.set(element.id, toBpmnElementId(element))
    }
    for (const definition of context.model.bpmnDefinitions) {
      idByDefinition.set(definition.id, toBpmnDefinitionId(definition))
    }
    const defaultFlowBySource = new Map<string, string>()
    const dataAssociationsByActivity = new Map<string, Array<BpmnDataAssociationElement>>()
    for (const element of context.model.elements) {
      if (element.type !== BPMN_FLOW_TYPE || !isModelerEdgeElement(element)) continue
      if (normalizeBpmnFlowType(element.data?.flowType) !== 'defaultSequence') continue
      const sourceId = element.source.elementId
      if (sourceId) defaultFlowBySource.set(sourceId, idByElement.get(element.id) ?? toBpmnElementId(element))
    }
    for (const element of context.model.elements) {
      if (element.type !== BPMN_DATA_ASSOCIATION_TYPE || !isModelerEdgeElement(element)) continue
      const activityId = resolveDataAssociationActivityId(element as BpmnDataAssociationElement)
      if (!activityId) continue
      const associations = dataAssociationsByActivity.get(activityId) ?? []
      associations.push(element as BpmnDataAssociationElement)
      dataAssociationsByActivity.set(activityId, associations)
    }
    const linkCatchDefinitionByRef = new Map<string, string>()
    for (const element of context.model.elements) {
      if (element.type !== BPMN_EVENT_TYPE) continue
      const event = element as BpmnEventElement
      const eventData = normalizeBpmnEventVariantData(event.data?.eventPosition, event.data?.trigger, event.data?.direction)
      const linkRef = resolveLinkRef(event)
      if (eventData.trigger !== 'link' || eventData.direction !== 'catch' || !linkRef) continue
      if (!linkCatchDefinitionByRef.has(linkRef)) linkCatchDefinitionByRef.set(linkRef, toBpmnLinkDefinitionId(event, idByElement))
    }
    return {
      processId,
      collaborationId: `${processId}_Collaboration`,
      diagramId: `${processId}_Diagram`,
      planeId: `${processId}_Plane`,
      idByElement,
      idByDefinition,
      defaultFlowBySource,
      dataAssociationsByActivity,
      linkCatchDefinitionByRef,
      geometry: new ModelerExportGeometry(),
    }
  }

  private serializeNode(element: ModelerElement, state: BpmnExportState): string {
    if (element.type === BPMN_DATA_OBJECT_TYPE) return this.serializeDataObject(element as BpmnDataObjectElement, state)
    if (element.type === BPMN_DATA_STORE_TYPE) return this.serializeDataStore(element as BpmnDataStoreElement, state)
    if (element.type === BPMN_TASK_TYPE) return this.serializeTask(element as BpmnTaskElement, state)
    if (element.type === BPMN_SUB_PROCESS_TYPE) return this.serializeSubProcess(element as BpmnSubProcessElement, state)
    if (element.type === BPMN_CALL_ACTIVITY_TYPE) return this.serializeCallActivity(element as BpmnCallActivityElement, state)
    if (element.type === BPMN_BOUNDARY_EVENT_TYPE) return this.serializeBoundaryEvent(element as BpmnBoundaryEventElement, state)
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
    const children = this.serializeTaskChildren(element, state)
    return children.length > 0
      ? [`<${tag} ${taskAttrs}>`, ...children.map(item => indent(item, 2)), `</${tag}>`].join('\n')
      : `<${tag} ${taskAttrs} />`
  }

  private serializeTaskChildren(element: BpmnTaskElement, state: BpmnExportState): Array<string> {
    const children: Array<string> = []
    const loopType = normalizeBpmnTaskLoopType(element.data?.loopType)
    if (loopType === 'standard') children.push('<standardLoopCharacteristics />')
    if (loopType === 'multiInstanceParallel') children.push('<multiInstanceLoopCharacteristics isSequential="false" />')
    if (loopType === 'multiInstanceSequential') children.push('<multiInstanceLoopCharacteristics isSequential="true" />')
    children.push(...this.serializeDataAssociationChildren(element, state))
    return children
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
    const children = this.serializeActivityLoopChildren(element, state)
    return children.length > 0
      ? [`<${tag} ${attrs}>`, ...children.map(item => indent(item, 2)), `</${tag}>`].join('\n')
      : `<${tag} ${attrs} />`
  }

  private serializeCallActivity(element: BpmnCallActivityElement, state: BpmnExportState): string {
    const attrs = [
      this.serializeNodeAttrs(element, state),
      element.data?.isForCompensation ? 'isForCompensation="true"' : '',
    ].filter(Boolean).join(' ')
    const children = this.serializeActivityLoopChildren(element, state)
    return children.length > 0
      ? [`<callActivity ${attrs}>`, ...children.map(item => indent(item, 2)), '</callActivity>'].join('\n')
      : `<callActivity ${attrs} />`
  }

  private serializeActivityLoopChildren(element: BpmnTaskElement | BpmnSubProcessElement | BpmnCallActivityElement, state: BpmnExportState): Array<string> {
    const children: Array<string> = []
    const loopType = normalizeBpmnTaskLoopType(element.data?.loopType)
    if (loopType === 'standard') children.push('<standardLoopCharacteristics />')
    if (loopType === 'multiInstanceParallel') children.push('<multiInstanceLoopCharacteristics isSequential="false" />')
    if (loopType === 'multiInstanceSequential') children.push('<multiInstanceLoopCharacteristics isSequential="true" />')
    children.push(...this.serializeDataAssociationChildren(element, state))
    return children
  }

  private serializeDataObject(element: BpmnDataObjectElement, state: BpmnExportState): string {
    return `<dataObjectReference ${this.serializeNodeAttrs(element, state)} />`
  }

  private serializeDataStore(element: BpmnDataStoreElement, state: BpmnExportState): string {
    return `<dataStoreReference ${this.serializeNodeAttrs(element, state)} />`
  }

  private serializeEvent(element: BpmnEventElement, state: BpmnExportState): string {
    const eventData = normalizeBpmnEventVariantData(element.data?.eventPosition, element.data?.trigger, element.data?.direction)
    const position = eventData.eventPosition
    const direction = eventData.direction
    const tag = position === 'start'
      ? 'startEvent'
      : position === 'end'
        ? 'endEvent'
        : direction === 'throw'
          ? 'intermediateThrowEvent'
          : 'intermediateCatchEvent'
    const attrs = this.serializeNodeAttrs(element, state)
    const eventDefinition = this.serializeEventDefinition(element, state)
    return eventDefinition
      ? [`<${tag} ${attrs}>`, `  ${eventDefinition}`, `</${tag}>`].join('\n')
      : `<${tag} ${attrs} />`
  }

  private serializeEventDefinition(element: BpmnEventElement, state: BpmnExportState): string {
    const trigger = normalizeBpmnEventVariantData(element.data?.eventPosition, element.data?.trigger, element.data?.direction).trigger
    if (trigger === 'message') return this.serializeReferencedEventDefinition('message', element, state)
    if (trigger === 'timer') return '<timerEventDefinition />'
    if (trigger === 'error') return this.serializeReferencedEventDefinition('error', element, state)
    if (trigger === 'escalation') return this.serializeReferencedEventDefinition('escalation', element, state)
    if (trigger === 'cancel') return '<cancelEventDefinition />'
    if (trigger === 'compensation') return '<compensateEventDefinition />'
    if (trigger === 'conditional') return '<conditionalEventDefinition />'
    if (trigger === 'link') return this.serializeLinkEventDefinition(element, state)
    if (trigger === 'signal') return this.serializeReferencedEventDefinition('signal', element, state)
    if (trigger === 'terminate') return '<terminateEventDefinition />'
    if (trigger === 'multiple') return '<multipleEventDefinition />'
    if (trigger === 'parallelMultiple') return '<parallelMultipleEventDefinition />'
    return ''
  }

  private serializeLinkEventDefinition(element: BpmnEventElement, state: BpmnExportState): string {
    const eventData = normalizeBpmnEventVariantData(element.data?.eventPosition, element.data?.trigger, element.data?.direction)
    const linkRef = resolveLinkRef(element)
    const attrs = [
      `id="${toBpmnLinkDefinitionId(element, state.idByElement)}"`,
      linkRef ? `name="${escapeXml(linkRef)}"` : '',
      eventData.direction === 'throw' && linkRef && state.linkCatchDefinitionByRef.get(linkRef)
        ? `target="${escapeXml(state.linkCatchDefinitionByRef.get(linkRef)!)}"`
        : '',
    ].filter(Boolean).join(' ')
    return `<linkEventDefinition ${attrs} />`
  }

  private serializeBoundaryEvent(element: BpmnBoundaryEventElement, state: BpmnExportState): string {
    const attachedToRef = this.resolveEndpointRef(element.data?.attachedToRef, state)
    const attrs = [
      this.serializeNodeAttrs(element, state),
      `attachedToRef="${attachedToRef}"`,
      element.data?.isInterrupting === false ? 'cancelActivity="false"' : '',
    ].filter(Boolean).join(' ')
    const eventDefinition = this.serializeBoundaryEventDefinition(element, state)
    return eventDefinition
      ? [`<boundaryEvent ${attrs}>`, `  ${eventDefinition}`, '</boundaryEvent>'].join('\n')
      : `<boundaryEvent ${attrs} />`
  }

  private serializeBoundaryEventDefinition(element: BpmnBoundaryEventElement, state: BpmnExportState): string {
    const trigger = element.data?.trigger ?? 'timer'
    if (trigger === 'message') return this.serializeReferencedEventDefinition('message', element, state)
    if (trigger === 'timer') return '<timerEventDefinition />'
    if (trigger === 'error') return this.serializeReferencedEventDefinition('error', element, state)
    if (trigger === 'escalation') return this.serializeReferencedEventDefinition('escalation', element, state)
    if (trigger === 'cancel') return '<cancelEventDefinition />'
    if (trigger === 'compensation') return '<compensateEventDefinition />'
    if (trigger === 'conditional') return '<conditionalEventDefinition />'
    if (trigger === 'signal') return this.serializeReferencedEventDefinition('signal', element, state)
    return '<timerEventDefinition />'
  }

  private serializeReferencedEventDefinition(kind: BpmnGlobalDefinitionKind, element: ModelerElement, state: BpmnExportState): string {
    const refKey = resolveBpmnGlobalDefinitionRefKey(kind)
    const ref = element.data?.[refKey]
    if (typeof ref !== 'string' || !ref.trim()) return `<${kind}EventDefinition />`
    const definitionId = state.idByDefinition.get(ref)
    if (!definitionId) return `<${kind}EventDefinition />`
    const attrName = `${kind}Ref`
    return `<${kind}EventDefinition ${attrName}="${escapeXml(definitionId)}" />`
  }

  private serializeGlobalDefinition(definition: BpmnGlobalDefinition, state: BpmnExportState): string {
    const id = this.requireBpmnDefinitionId(definition, state)
    const attrs = [
      `id="${id}"`,
      definition.name ? `name="${escapeXml(definition.name)}"` : '',
      this.serializeGlobalDefinitionCodeAttr(definition),
    ].filter(Boolean).join(' ')
    return `<${definition.kind} ${attrs} />`
  }

  private serializeGlobalDefinitionCodeAttr(definition: BpmnGlobalDefinition): string {
    if (!definition.code) return ''
    if (definition.kind === 'error') return `errorCode="${escapeXml(definition.code)}"`
    if (definition.kind === 'escalation') return `escalationCode="${escapeXml(definition.code)}"`
    return ''
  }

  private serializeCollaborationItems(context: ModelerExportContext, state: BpmnExportState): Array<string> {
    const participants = context.model.elements.filter((element): element is BpmnParticipantElement => element.type === BPMN_PARTICIPANT_TYPE)
    const messageFlows = context.model.elements.filter((element): element is BpmnMessageFlowElement => element.type === BPMN_MESSAGE_FLOW_TYPE && isModelerEdgeElement(element))
    if (participants.length === 0 && messageFlows.length === 0) return []
    return [[
      `<collaboration id="${state.collaborationId}">`,
      ...participants.map(participant => indent(this.serializeParticipant(participant, state), 2)),
      ...messageFlows.map(messageFlow => indent(this.serializeMessageFlow(messageFlow, state), 2)),
      '</collaboration>',
    ].join('\n')]
  }

  private serializeParticipant(element: BpmnParticipantElement, state: BpmnExportState): string {
    const attrs = [
      `id="${this.requireBpmnId(element, state)}"`,
      this.resolveName(element) ? `name="${escapeXml(this.resolveName(element))}"` : '',
      `processRef="${state.processId}"`,
    ].filter(Boolean).join(' ')
    return `<participant ${attrs} />`
  }

  private serializeMessageFlow(element: BpmnMessageFlowElement, state: BpmnExportState): string {
    const attrs = [
      `id="${this.requireBpmnId(element, state)}"`,
      this.resolveName(element) ? `name="${escapeXml(this.resolveName(element))}"` : '',
      `sourceRef="${this.resolveEndpointRef(element.source.elementId, state)}"`,
      `targetRef="${this.resolveEndpointRef(element.target.elementId, state)}"`,
      this.resolveMessageRefAttr(element, state),
    ].filter(Boolean).join(' ')
    return `<messageFlow ${attrs} />`
  }

  private resolveMessageRefAttr(element: BpmnMessageFlowElement, state: BpmnExportState): string {
    const ref = element.data?.messageRef
    if (typeof ref !== 'string' || !ref.trim()) return ''
    const definitionId = state.idByDefinition.get(ref)
    return definitionId ? `messageRef="${definitionId}"` : ''
  }

  private serializeDataAssociationChildren(element: ModelerElement, state: BpmnExportState): Array<string> {
    return (state.dataAssociationsByActivity.get(element.id) ?? []).map(association => {
      const type = normalizeBpmnDataAssociationType(association.data?.dataAssociationType)
      const tag = type === 'output' ? 'dataOutputAssociation' : 'dataInputAssociation'
      const sourceRef = this.resolveEndpointRef(association.source.elementId, state)
      const targetRef = this.resolveEndpointRef(association.target.elementId, state)
      return [
        `<${tag} id="${this.requireBpmnId(association, state)}">`,
        `  <sourceRef>${sourceRef}</sourceRef>`,
        `  <targetRef>${targetRef}</targetRef>`,
        `</${tag}>`,
      ].join('\n')
    })
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
    const attrs = [
      `id="${id}"`,
      this.resolveName(element) ? `name="${escapeXml(this.resolveName(element))}"` : '',
      `sourceRef="${sourceRef}"`,
      `targetRef="${targetRef}"`,
    ].filter(Boolean).join(' ')
    if (flowType !== 'conditionalSequence') return `<sequenceFlow ${attrs} />`
    const condition = typeof element.data?.conditionExpression === 'string' && element.data.conditionExpression.trim()
      ? element.data.conditionExpression.trim()
      : 'true'
    return [
      `<sequenceFlow ${attrs}>`,
      `  <conditionExpression xsi:type="tFormalExpression">${escapeXml(condition)}</conditionExpression>`,
      '</sequenceFlow>',
    ].join('\n')
  }

  private serializeDiagramElement(context: ModelerExportContext, element: ModelerElement, state: BpmnExportState): string {
    const id = this.requireBpmnId(element, state)
    if (isModelerEdgeElement(element)) {
      const path = state.geometry.resolveEdgePath(context.model, element, context.pluginContext)
      const label = this.serializeDiagramLabel(context, element)
      return [
        `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">`,
        ...path.map(point => `  <di:waypoint x="${round(point.x)}" y="${round(point.y)}" />`),
        ...(label ? [label] : []),
        '</bpmndi:BPMNEdge>',
      ].join('\n')
    }
    const label = this.serializeDiagramLabel(context, element)
    return [
      `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">`,
      `  <dc:Bounds x="${round(element.x)}" y="${round(element.y)}" width="${round(element.width)}" height="${round(element.height)}" />`,
      ...(label ? [label] : []),
      '</bpmndi:BPMNShape>',
    ].join('\n')
  }

  private serializeDiagramLabel(context: ModelerExportContext, element: ModelerElement): string {
    if (!context.pluginContext) return ''
    if (!this.resolveName(element)) return ''
    const definition = context.pluginContext.getElementRegistry().get(element.type)
    if (!definition?.externalLabel) return ''
    const layout = context.pluginContext.externalLabels.resolve(context.pluginContext, element)
    if (!layout) return ''
    return [
      '  <bpmndi:BPMNLabel>',
      `    <dc:Bounds x="${round(layout.worldRect.x)}" y="${round(layout.worldRect.y)}" width="${round(layout.worldRect.width)}" height="${round(layout.worldRect.height)}" />`,
      '  </bpmndi:BPMNLabel>',
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

  private requireBpmnDefinitionId(definition: BpmnGlobalDefinition, state: BpmnExportState): string {
    const id = state.idByDefinition.get(definition.id)
    if (!id) throw new Error(`[BpmnExporter] Missing BPMN definition id for definition: ${definition.id}`)
    return id
  }
}

function toBpmnDefinitionId(definition: Pick<BpmnGlobalDefinition, 'id' | 'kind'>): string {
  const prefix = definition.kind === 'message'
    ? 'Message'
    : definition.kind === 'signal'
      ? 'Signal'
      : definition.kind === 'error'
        ? 'Error'
        : 'Escalation'
  return toBpmnId(prefix, definition.id)
}

function toBpmnElementId(element: ModelerElement): string {
  const prefix = element.type === BPMN_TASK_TYPE
    ? 'Task'
    : element.type === BPMN_DATA_OBJECT_TYPE
      ? 'DataObject'
      : element.type === BPMN_DATA_STORE_TYPE
        ? 'DataStore'
        : element.type === BPMN_DATA_ASSOCIATION_TYPE
          ? 'DataAssociation'
          : element.type === BPMN_MESSAGE_FLOW_TYPE
            ? 'MessageFlow'
            : element.type === BPMN_PARTICIPANT_TYPE
              ? 'Participant'
              : element.type === BPMN_BOUNDARY_EVENT_TYPE
                ? 'BoundaryEvent'
                : element.type === BPMN_EVENT_TYPE
                  ? 'Event'
                  : element.type === BPMN_GATEWAY_TYPE
                    ? 'Gateway'
                    : element.type === BPMN_FLOW_TYPE
                      ? 'Flow'
                      : 'Element'
  return toBpmnId(prefix, element.id)
}

function toBpmnLinkDefinitionId(element: BpmnEventElement, idByElement: Map<string, string>): string {
  return `${idByElement.get(element.id) ?? toBpmnElementId(element)}_LinkDefinition`
}

function resolveLinkRef(element: BpmnEventElement): string {
  return typeof element.data?.linkRef === 'string' ? element.data.linkRef.trim() : ''
}

function resolveDataAssociationActivityId(element: BpmnDataAssociationElement): string | undefined {
  const type = normalizeBpmnDataAssociationType(element.data?.dataAssociationType)
  return type === 'output' ? element.source.elementId : element.target.elementId
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
