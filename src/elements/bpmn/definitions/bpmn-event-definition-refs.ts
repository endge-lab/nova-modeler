import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  BpmnGlobalDefinition,
  BpmnGlobalDefinitionKind,
  ModelerElement,
  ModelerElementVariantControl,
  ModelerElementVariantDraft,
  ModelerElementVariantOption,
  ModelerPluginContext,
} from '@/domain/types'
import {
  createBpmnGlobalDefinition,
  defaultBpmnGlobalDefinitionName,
  resolveBpmnGlobalDefinitionKindForTrigger,
  resolveBpmnGlobalDefinitionRefKey,
  type BpmnGlobalDefinitionRefKey,
} from '@/model/bpmn-definitions'

const CREATE_DEFINITION_ID = '__create-bpmn-definition__'

export function createBpmnEventDefinitionRefControls(
  context: ModelerPluginContext,
  element: ModelerElement,
  trigger: unknown,
  draft: ModelerElementVariantDraft,
): Array<ModelerElementVariantControl> {
  const kind = resolveBpmnGlobalDefinitionKindForTrigger(trigger)
  if (!kind) return []
  const refKey = resolveBpmnGlobalDefinitionRefKey(kind)
  const definitions = resolveDefinitionsByKind(context, kind)
  const currentRef = resolveCurrentDefinitionRef(element, draft, refKey)
  const selected = definitions.find(definition => definition.id === currentRef) ?? definitions[0]
  const label = resolveDefinitionLabel(kind)
  return [
    {
      id: refKey,
      kind: 'list',
      title: `${label} definition`,
      value: selected?.id ?? CREATE_DEFINITION_ID,
      options: [
        ...definitions.map(definition => ({
          id: definition.id,
          title: definition.name,
          selected: definition.id === selected?.id,
          icon: resolveDefinitionIcon(kind),
          data: { [refKey]: definition.id },
        })),
        {
          id: CREATE_DEFINITION_ID,
          title: `Create ${label.toLowerCase()}`,
          icon: resolveDefinitionIcon(kind),
          selected: definitions.length === 0,
          data: { createBpmnDefinitionKind: kind },
        },
      ],
    },
    {
      id: 'definitionName',
      kind: 'input',
      title: 'Definition name',
      value: selected?.name ?? defaultBpmnGlobalDefinitionName(kind),
      placeholder: defaultBpmnGlobalDefinitionName(kind),
      options: [],
    },
  ]
}

export function updateBpmnEventDefinitionDraft(
  element: ModelerElement,
  draft: ModelerElementVariantDraft,
  option: ModelerElementVariantOption,
): ModelerElementVariantDraft {
  return {
    messageRef: option.data?.messageRef ?? draft.messageRef ?? element.data?.messageRef,
    signalRef: option.data?.signalRef ?? draft.signalRef ?? element.data?.signalRef,
    errorRef: option.data?.errorRef ?? draft.errorRef ?? element.data?.errorRef,
    escalationRef: option.data?.escalationRef ?? draft.escalationRef ?? element.data?.escalationRef,
    linkRef: option.data?.linkRef ?? draft.linkRef ?? element.data?.linkRef,
  }
}

export function applyBpmnEventDefinitionRefControl(params: {
  context: ModelerPluginContext
  element: ModelerElement
  trigger: unknown
  draft: ModelerElementVariantDraft
  control: ModelerElementVariantControl
  option: ModelerElementVariantOption
}): Record<string, unknown> | null {
  const kind = resolveBpmnGlobalDefinitionKindForTrigger(params.trigger)
  if (!kind) return null
  const refKey = resolveBpmnGlobalDefinitionRefKey(kind)
  if (params.control.id === refKey) {
    const next = params.option.data?.createBpmnDefinitionKind === kind
      ? createAndStoreDefinition(params.context, kind, params.element)
      : resolveDefinitionsByKind(params.context, kind).find(definition => definition.id === params.option.data?.[refKey])
    return next ? { [refKey]: next.id } : null
  }
  if (params.control.id !== 'definitionName') return null
  const definition = ensureBpmnGlobalDefinitionForTrigger(params.context, params.element, params.trigger, params.draft)
  if (!definition) return null
  const name = String(params.option.data?.definitionName ?? params.option.title ?? '').trim() || defaultBpmnGlobalDefinitionName(kind)
  upsertDefinition(params.context, { ...definition, name })
  return { [refKey]: definition.id }
}

export function ensureBpmnGlobalDefinitionPatchForTrigger(
  context: ModelerPluginContext,
  element: ModelerElement,
  trigger: unknown,
  draft: ModelerElementVariantDraft,
): Record<string, unknown> {
  const definition = ensureBpmnGlobalDefinitionForTrigger(context, element, trigger, draft)
  if (!definition) return {}
  const kind = resolveBpmnGlobalDefinitionKindForTrigger(trigger)
  if (!kind) return {}
  return { [resolveBpmnGlobalDefinitionRefKey(kind)]: definition.id }
}

function ensureBpmnGlobalDefinitionForTrigger(
  context: ModelerPluginContext,
  element: ModelerElement,
  trigger: unknown,
  draft: ModelerElementVariantDraft,
): BpmnGlobalDefinition | null {
  const kind = resolveBpmnGlobalDefinitionKindForTrigger(trigger)
  if (!kind) return null
  const refKey = resolveBpmnGlobalDefinitionRefKey(kind)
  const definitions = resolveDefinitionsByKind(context, kind)
  const currentRef = resolveCurrentDefinitionRef(element, draft, refKey)
  const existing = definitions.find(definition => definition.id === currentRef) ?? definitions[0]
  if (existing) return existing
  return createAndStoreDefinition(context, kind, element)
}

function createAndStoreDefinition(context: ModelerPluginContext, kind: BpmnGlobalDefinitionKind, element: ModelerElement): BpmnGlobalDefinition {
  const definitions = context.getModel().bpmnDefinitions
  const definition = createBpmnGlobalDefinition(kind, {
    id: `${kind}-${element.id}`,
    name: defaultBpmnGlobalDefinitionName(kind),
  }, definitions)
  upsertDefinition(context, definition)
  return definition
}

function upsertDefinition(context: ModelerPluginContext, definition: BpmnGlobalDefinition): void {
  const definitions = context.getModel().bpmnDefinitions
  context.applyCommand({
    type: 'bpmn.definitions.set',
    definitions: [
      ...definitions.filter(item => item.id !== definition.id),
      definition,
    ],
  })
}

function resolveDefinitionsByKind(context: ModelerPluginContext, kind: BpmnGlobalDefinitionKind): Array<BpmnGlobalDefinition> {
  return context.getModel().bpmnDefinitions.filter(definition => definition.kind === kind)
}

function resolveCurrentDefinitionRef(
  element: ModelerElement,
  draft: ModelerElementVariantDraft,
  refKey: BpmnGlobalDefinitionRefKey,
): string | undefined {
  const draftValue = draft[refKey]
  if (typeof draftValue === 'string' && draftValue) return draftValue
  const elementValue = element.data?.[refKey]
  return typeof elementValue === 'string' && elementValue ? elementValue : undefined
}

function resolveDefinitionLabel(kind: BpmnGlobalDefinitionKind): string {
  if (kind === 'message') return 'Message'
  if (kind === 'signal') return 'Signal'
  if (kind === 'error') return 'Error'
  return 'Escalation'
}

function resolveDefinitionIcon(kind: BpmnGlobalDefinitionKind) {
  if (kind === 'message') return MODELER_ASSETS.icons.message
  if (kind === 'signal') return MODELER_ASSETS.icons.signal
  if (kind === 'error') return MODELER_ASSETS.icons.error
  return MODELER_ASSETS.icons.escalation
}
