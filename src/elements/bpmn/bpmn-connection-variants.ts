import type {
  ModelerEdgeElement,
  ModelerElementVariantControl,
  ModelerElementVariantDescriptor,
  ModelerElementVariantDraft,
  ModelerElementVariantOption,
  ModelerPluginContext,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { createBpmnAssociationElement } from '@/elements/bpmn/association/bpmn-association.factory'
import type {
  BpmnAssociationElement,
  BpmnAssociationType,
} from '@/elements/bpmn/association/bpmn-association.types'
import { createBpmnFlowElement } from '@/elements/bpmn/flow/bpmn-flow.factory'
import type {
  BpmnFlowElement,
  BpmnFlowType,
} from '@/elements/bpmn/flow/bpmn-flow.types'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'

export type BpmnConnectionFamily = 'flow' | 'association'

export interface BpmnConnectionVariantDraft extends ModelerElementVariantDraft {
  connectionFamily?: BpmnConnectionFamily
  flowType?: BpmnFlowType
  associationType?: BpmnAssociationType
}

const CONNECTION_FAMILIES: Array<{
  id: BpmnConnectionFamily
  title: string
  description: string
}> = [
  { id: 'flow', title: 'Sequence flow', description: 'Solid BPMN control flow.' },
  { id: 'association', title: 'Association', description: 'Dashed BPMN association.' },
]

const FLOW_TYPES: Array<{ id: BpmnFlowType; title: string; description: string }> = [
  { id: 'sequence', title: 'Sequence', description: 'Regular BPMN sequence flow.' },
  { id: 'conditionalSequence', title: 'Conditional sequence', description: 'Sequence flow with a condition marker.' },
  { id: 'defaultSequence', title: 'Default sequence', description: 'Default outgoing sequence flow.' },
]

const ASSOCIATION_TYPES: Array<{ id: BpmnAssociationType; title: string; description: string }> = [
  { id: 'undirected', title: 'Association', description: 'Dashed association without direction.' },
  { id: 'directed', title: 'Directed association', description: 'Dashed association with a target arrow.' },
  { id: 'bidirectional', title: 'Bidirectional association', description: 'Dashed association with source and target arrows.' },
  { id: 'data', title: 'Data association', description: 'BPMN data association.' },
]

export function createBpmnConnectionDraft(element: BpmnFlowElement | BpmnAssociationElement): BpmnConnectionVariantDraft {
  const family = resolveElementFamily(element)
  return {
    connectionFamily: family,
    flowType: isBpmnFlowElement(element) ? normalizeFlowType(element.data?.flowType) : 'sequence',
    associationType: isBpmnAssociationElement(element) ? normalizeAssociationType(element.data?.associationType) : 'undirected',
  }
}

export function getBpmnConnectionVariantDescriptor(
  element: BpmnFlowElement | BpmnAssociationElement,
  draft: ModelerElementVariantDraft,
): ModelerElementVariantDescriptor {
  const typedDraft = resolveConnectionDraft(element, draft)
  const family = typedDraft.connectionFamily ?? resolveElementFamily(element)
  const variantControl: ModelerElementVariantControl = family === 'association'
    ? createAssociationVariantControl(typedDraft.associationType)
    : createFlowVariantControl(typedDraft.flowType)
  return {
    title: 'Change connection',
    controls: [
      {
        id: 'connectionFamily',
        kind: 'choice',
        title: 'Connection type',
        value: family,
        options: CONNECTION_FAMILIES.map(option => ({
          ...option,
          selected: option.id === family,
          data: { connectionFamily: option.id },
        })),
      },
      variantControl,
    ],
  }
}

export function updateBpmnConnectionVariantDraft(
  element: BpmnFlowElement | BpmnAssociationElement,
  draft: ModelerElementVariantDraft,
  control: ModelerElementVariantControl,
  option: ModelerElementVariantOption,
): BpmnConnectionVariantDraft {
  const current = resolveConnectionDraft(element, draft)
  if (control.id === 'connectionFamily') {
    return {
      ...current,
      connectionFamily: resolveFamily(option.data?.connectionFamily, current.connectionFamily),
    }
  }
  if (control.id === 'flowType') {
    return {
      ...current,
      connectionFamily: 'flow',
      flowType: normalizeFlowType(option.data?.flowType ?? option.id),
    }
  }
  if (control.id === 'associationType') {
    return {
      ...current,
      connectionFamily: 'association',
      associationType: normalizeAssociationType(option.data?.associationType ?? option.id),
    }
  }
  return current
}

export function applyBpmnConnectionVariant(input: {
  context: ModelerPluginContext
  element: BpmnFlowElement | BpmnAssociationElement
  draft: ModelerElementVariantDraft
  control: ModelerElementVariantControl
  option: ModelerElementVariantOption
}): void {
  const nextDraft = updateBpmnConnectionVariantDraft(input.element, input.draft, input.control, input.option)
  const family = nextDraft.connectionFamily ?? resolveElementFamily(input.element)
  if (family === 'association') {
    applyAssociationVariant(input.context, input.element, nextDraft.associationType)
    return
  }
  applyFlowVariant(input.context, input.element, nextDraft.flowType)
}

function createFlowVariantControl(value: unknown): ModelerElementVariantControl {
  const flowType = normalizeFlowType(value)
  return {
    id: 'flowType',
    kind: 'list',
    title: 'Sequence flow variant',
    value: flowType,
    options: FLOW_TYPES.map(option => ({
      ...option,
      selected: option.id === flowType,
      data: {
        connectionFamily: 'flow',
        flowType: option.id,
      },
    })),
  }
}

function createAssociationVariantControl(value: unknown): ModelerElementVariantControl {
  const associationType = normalizeAssociationType(value)
  return {
    id: 'associationType',
    kind: 'list',
    title: 'Association variant',
    value: associationType,
    options: ASSOCIATION_TYPES.map(option => ({
      ...option,
      selected: option.id === associationType,
      data: {
        connectionFamily: 'association',
        associationType: option.id,
      },
    })),
  }
}

function applyFlowVariant(
  context: ModelerPluginContext,
  element: BpmnFlowElement | BpmnAssociationElement,
  flowType: unknown,
): void {
  if (isBpmnFlowElement(element)) {
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          flowType: normalizeFlowType(flowType),
        },
      },
    })
    return
  }
  const nextElement = createBpmnFlowElement({
    ...createBaseEdgeInput(element),
    data: sanitizeConnectionData(element.data),
    flowType: normalizeFlowType(flowType),
  })
  if (showDuplicateConnectionWarning(context, element, nextElement, 'Sequence flow')) return
  context.applyCommand({
    type: 'element.replace',
    id: element.id,
    element: nextElement,
  })
}

function applyAssociationVariant(
  context: ModelerPluginContext,
  element: BpmnFlowElement | BpmnAssociationElement,
  associationType: unknown,
): void {
  if (isBpmnAssociationElement(element)) {
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: {
        data: {
          ...element.data,
          associationType: normalizeAssociationType(associationType),
        },
      },
    })
    return
  }
  const nextElement = createBpmnAssociationElement({
    ...createBaseEdgeInput(element),
    data: sanitizeConnectionData(element.data),
    associationType: normalizeAssociationType(associationType),
  })
  if (showDuplicateConnectionWarning(context, element, nextElement, 'Association')) return
  context.applyCommand({
    type: 'element.replace',
    id: element.id,
    element: nextElement,
  })
}

function showDuplicateConnectionWarning(
  context: ModelerPluginContext,
  current: ModelerEdgeElement,
  next: ModelerEdgeElement,
  title: string,
): boolean {
  const duplicate = findDuplicateConnection(context, current.id, next)
  if (!duplicate) return false
  context.applyCommand({ type: 'select', ids: [duplicate.id] })
  MODEL_ELEMENTS_RUNTIME.connectionWarnings.show({
    title: 'Connection already exists',
    message: `${title} already exists between these elements. Remove the existing connection or choose another connection type.`,
    duplicateElementId: duplicate.id,
  })
  return true
}

function findDuplicateConnection(
  context: ModelerPluginContext,
  currentId: string,
  candidate: ModelerEdgeElement,
): ModelerEdgeElement | undefined {
  const sourceId = candidate.source.elementId
  const targetId = candidate.target.elementId
  if (!sourceId || !targetId) return undefined
  return context.getModel().elements.find((element): element is ModelerEdgeElement => {
    if (element.id === currentId || !isModelerEdgeElement(element)) return false
    return element.type === candidate.type
      && element.source.elementId === sourceId
      && element.target.elementId === targetId
  })
}

function createBaseEdgeInput(element: ModelerEdgeElement) {
  return {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    zIndex: element.zIndex,
    source: {
      ...element.source,
      point: element.source.point ? { ...element.source.point } : undefined,
    },
    target: {
      ...element.target,
      point: element.target.point ? { ...element.target.point } : undefined,
    },
    waypoints: element.waypoints.map(point => ({ ...point })),
    style: { ...element.style },
  }
}

function sanitizeConnectionData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const { flowType: _flowType, associationType: _associationType, ...rest } = data ?? {}
  return rest
}

function resolveConnectionDraft(
  element: BpmnFlowElement | BpmnAssociationElement,
  draft: ModelerElementVariantDraft,
): BpmnConnectionVariantDraft {
  const fallback = createBpmnConnectionDraft(element)
  return {
    connectionFamily: resolveFamily(draft.connectionFamily, fallback.connectionFamily),
    flowType: normalizeFlowType(draft.flowType ?? fallback.flowType),
    associationType: normalizeAssociationType(draft.associationType ?? fallback.associationType),
  }
}

function resolveElementFamily(element: BpmnFlowElement | BpmnAssociationElement): BpmnConnectionFamily {
  return isBpmnAssociationElement(element) ? 'association' : 'flow'
}

function resolveFamily(value: unknown, fallback: unknown): BpmnConnectionFamily {
  if (value === 'association' || value === 'flow') return value
  return fallback === 'association' ? 'association' : 'flow'
}

function normalizeFlowType(value: unknown): BpmnFlowType {
  if (value === 'conditionalSequence' || value === 'defaultSequence' || value === 'sequence') return value
  return 'sequence'
}

function normalizeAssociationType(value: unknown): BpmnAssociationType {
  if (value === 'directed' || value === 'bidirectional' || value === 'data' || value === 'undirected') return value
  return 'undirected'
}

function isBpmnFlowElement(element: ModelerEdgeElement): element is BpmnFlowElement {
  return element.type === 'bpmn.flow'
}

function isBpmnAssociationElement(element: ModelerEdgeElement): element is BpmnAssociationElement {
  return element.type === 'bpmn.association'
}
