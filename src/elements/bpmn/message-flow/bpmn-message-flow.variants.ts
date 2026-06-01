import { MODELER_ASSETS } from '@/assets/modeler-assets'
import type {
  BpmnGlobalDefinition,
  ModelerElementVariantProvider,
} from '@/domain/types/index'
import {
  createBpmnGlobalDefinition,
  defaultBpmnGlobalDefinitionName,
} from '@/model/bpmn-definitions'
import {
  BPMN_MESSAGE_FLOW_TYPE,
} from '@/elements/bpmn/message-flow/bpmn-message-flow.factory'
import type {
  BpmnMessageFlowElement,
} from '@/elements/bpmn/message-flow/bpmn-message-flow.types'

const CREATE_MESSAGE_ID = '__create-message-definition__'

export const BpmnMessageFlowVariantProvider: ModelerElementVariantProvider<BpmnMessageFlowElement> = {
  id: 'bpmn.messageFlow.variants',
  matches: (_context, element): element is BpmnMessageFlowElement => element.type === BPMN_MESSAGE_FLOW_TYPE,
  createDraft: (_context, element) => ({
    messageRef: element.data?.messageRef,
  }),
  getDescriptor: (context, element, draft) => {
    const definitions = context.getModel().bpmnDefinitions.filter(definition => definition.kind === 'message')
    const messageRef = typeof draft.messageRef === 'string' ? draft.messageRef : element.data?.messageRef
    const selected = definitions.find(definition => definition.id === messageRef) ?? definitions[0]
    return {
      title: 'Change message flow',
      controls: [
        {
          id: 'messageRef',
          kind: 'list',
          title: 'Message definition',
          value: selected?.id ?? CREATE_MESSAGE_ID,
          options: [
            ...definitions.map(definition => ({
              id: definition.id,
              title: definition.name,
              icon: MODELER_ASSETS.icons.message,
              selected: definition.id === selected?.id,
              data: { messageRef: definition.id },
            })),
            {
              id: CREATE_MESSAGE_ID,
              title: 'Create message',
              icon: MODELER_ASSETS.icons.message,
              selected: definitions.length === 0,
              data: { createMessageDefinition: true },
            },
          ],
        },
        {
          id: 'definitionName',
          kind: 'input',
          title: 'Definition name',
          value: selected?.name ?? defaultBpmnGlobalDefinitionName('message'),
          placeholder: defaultBpmnGlobalDefinitionName('message'),
          options: [],
        },
      ],
    }
  },
  updateDraft: (_context, element, draft, _control, option) => ({
    ...draft,
    messageRef: option.data?.messageRef ?? draft.messageRef ?? element.data?.messageRef,
  }),
  apply: ({ context, element, control, option }) => {
    if (control.id === 'messageRef') {
      const definition = option.data?.createMessageDefinition === true
        ? createAndStoreMessageDefinition(context.getModel().bpmnDefinitions, context.applyCommand, element)
        : context.getModel().bpmnDefinitions.find(item => item.kind === 'message' && item.id === option.data?.messageRef)
      if (!definition) return
      context.applyCommand({
        type: 'element.patch',
        id: element.id,
        patch: { data: { messageRef: definition.id } },
      })
      return
    }
    if (control.id !== 'definitionName') return
    const existing = resolveSelectedMessageDefinition(context.getModel().bpmnDefinitions, element.data?.messageRef)
      ?? createAndStoreMessageDefinition(context.getModel().bpmnDefinitions, context.applyCommand, element)
    const name = String(option.data?.definitionName ?? option.title ?? '').trim() || defaultBpmnGlobalDefinitionName('message')
    context.applyCommand({
      type: 'bpmn.definitions.set',
      definitions: [
        ...context.getModel().bpmnDefinitions.filter(definition => definition.id !== existing.id),
        { ...existing, name },
      ],
    })
    context.applyCommand({
      type: 'element.patch',
      id: element.id,
      patch: { data: { messageRef: existing.id } },
    })
  },
}

function createAndStoreMessageDefinition(
  definitions: Array<BpmnGlobalDefinition>,
  applyCommand: Parameters<ModelerElementVariantProvider<BpmnMessageFlowElement>['apply']>[0]['context']['applyCommand'],
  element: BpmnMessageFlowElement,
): BpmnGlobalDefinition {
  const definition = createBpmnGlobalDefinition('message', {
    id: `message-${element.id}`,
    name: defaultBpmnGlobalDefinitionName('message'),
  }, definitions)
  applyCommand({
    type: 'bpmn.definitions.set',
    definitions: [...definitions, definition],
  })
  return definition
}

function resolveSelectedMessageDefinition(
  definitions: Array<BpmnGlobalDefinition>,
  messageRef: unknown,
): BpmnGlobalDefinition | undefined {
  if (typeof messageRef === 'string' && messageRef) {
    return definitions.find(definition => definition.kind === 'message' && definition.id === messageRef)
  }
  return definitions.find(definition => definition.kind === 'message')
}
