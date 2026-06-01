import type {
  BpmnGlobalDefinition,
  BpmnGlobalDefinitionInput,
  BpmnGlobalDefinitionKind,
} from '@/domain/types/model/bpmn-definitions.types'

export type BpmnGlobalDefinitionRefKey = 'messageRef' | 'signalRef' | 'errorRef' | 'escalationRef'

export const BPMN_GLOBAL_DEFINITION_KINDS: Array<BpmnGlobalDefinitionKind> = [
  'message',
  'signal',
  'error',
  'escalation',
]

export function normalizeBpmnGlobalDefinitions(input: Array<BpmnGlobalDefinitionInput> = []): Array<BpmnGlobalDefinition> {
  const ids = new Set<string>()
  return input.map((definition, index) => normalizeBpmnGlobalDefinition(definition, index))
    .filter(definition => {
      if (ids.has(definition.id)) return false
      ids.add(definition.id)
      return true
    })
}

export function createBpmnGlobalDefinition(
  kind: BpmnGlobalDefinitionKind,
  input: BpmnGlobalDefinitionInput = {},
  existing: Array<BpmnGlobalDefinitionInput> = [],
): BpmnGlobalDefinition {
  const existingIds = new Set(existing.map(definition => normalizeDefinitionId(definition.id, definition.kind ?? kind, 0)))
  const id = normalizeDefinitionId(input.id, kind, existing.length)
  return normalizeBpmnGlobalDefinition({
    ...input,
    id: existingIds.has(id) ? createUniqueDefinitionId(kind, id, existingIds) : id,
    kind,
    name: input.name ?? defaultBpmnGlobalDefinitionName(kind),
  }, existing.length)
}

export function resolveBpmnGlobalDefinitionKindForTrigger(trigger: unknown): BpmnGlobalDefinitionKind | undefined {
  if (trigger === 'message' || trigger === 'signal' || trigger === 'error' || trigger === 'escalation') return trigger
  return undefined
}

export function resolveBpmnGlobalDefinitionRefKey(kind: BpmnGlobalDefinitionKind): BpmnGlobalDefinitionRefKey {
  if (kind === 'message') return 'messageRef'
  if (kind === 'signal') return 'signalRef'
  if (kind === 'error') return 'errorRef'
  return 'escalationRef'
}

export function defaultBpmnGlobalDefinitionName(kind: BpmnGlobalDefinitionKind): string {
  if (kind === 'message') return 'Message'
  if (kind === 'signal') return 'Signal'
  if (kind === 'error') return 'Error'
  return 'Escalation'
}

export function cloneBpmnGlobalDefinition(definition: BpmnGlobalDefinition): BpmnGlobalDefinition {
  return {
    id: definition.id,
    kind: definition.kind,
    name: definition.name,
    code: definition.code,
  }
}

function normalizeBpmnGlobalDefinition(input: BpmnGlobalDefinitionInput, index: number): BpmnGlobalDefinition {
  const kind = normalizeDefinitionKind(input.kind)
  return {
    id: normalizeDefinitionId(input.id, kind, index),
    kind,
    name: normalizeString(input.name, defaultBpmnGlobalDefinitionName(kind)),
    code: typeof input.code === 'string' && input.code.trim() ? input.code.trim() : undefined,
  }
}

function normalizeDefinitionKind(value: unknown): BpmnGlobalDefinitionKind {
  return BPMN_GLOBAL_DEFINITION_KINDS.includes(value as BpmnGlobalDefinitionKind)
    ? value as BpmnGlobalDefinitionKind
    : 'message'
}

function normalizeDefinitionId(value: unknown, kind: BpmnGlobalDefinitionKind, index: number): string {
  const raw = typeof value === 'string' && value.trim()
    ? value.trim()
    : `${kind}-${index + 1}`
  const safe = raw
    .replace(/[^A-Za-z0-9_.-]/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return safe || `${kind}-${index + 1}`
}

function createUniqueDefinitionId(kind: BpmnGlobalDefinitionKind, base: string, existingIds: Set<string>): string {
  let index = 2
  let id = `${base}-${index}`
  while (existingIds.has(id)) {
    index += 1
    id = `${base}-${index}`
  }
  return id || `${kind}-${index}`
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}
