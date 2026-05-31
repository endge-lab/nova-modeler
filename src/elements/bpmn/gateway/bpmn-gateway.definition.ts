import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
  ModelerPoint,
} from '@/domain/types/index'
import {
  BPMN_GATEWAY_DEFAULT_SIZE,
  BPMN_GATEWAY_TYPE,
  createBpmnGatewayElement,
} from '@/elements/bpmn/gateway/bpmn-gateway.factory'
import { createBpmnGatewayPorts } from '@/elements/bpmn/gateway/bpmn-gateway.ports'
import { BpmnGatewayVariantProvider } from '@/elements/bpmn/gateway/bpmn-gateway.variants'
import type {
  BpmnGatewayElement,
  BpmnGatewayElementInput,
} from '@/elements/bpmn/gateway/bpmn-gateway.types'

export const BpmnGatewayDefinition: ModelerElementDefinition<BpmnGatewayElement> = {
  type: BPMN_GATEWAY_TYPE,
  kind: 'node',
  title: 'Gateway',
  defaults: {
    width: BPMN_GATEWAY_DEFAULT_SIZE,
    height: BPMN_GATEWAY_DEFAULT_SIZE,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    ports: {
      visible: 'selected',
      strategy: 'definition',
    },
    connectable: {
      incoming: true,
      outgoing: true,
    },
    cursor: {
      body: 'default',
      hover: 'move',
      drag: 'grabbing',
    },
  },
  createTool: {
    id: 'create:bpmn.gateway',
    actionId: 'element.create.bpmn.gateway',
    shortcutId: 'bpmn.gateway.create',
    title: 'Gateway',
    palette: {
      id: 'bpmn.gateway.create',
      group: 'elements',
      order: 115,
      icon: 'bpmn-gateway',
    },
    shortcuts: [{ key: 'g' }],
    create: input => createBpmnGatewayElement(input as BpmnGatewayElementInput),
  },
  variantProvider: BpmnGatewayVariantProvider,
  normalize: element => createBpmnGatewayElement(element as BpmnGatewayElementInput),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BpmnGatewayView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBpmnGatewayPorts(element),
  hitTest: (_context, element, localPoint) => containsBpmnGatewayPoint(element, localPoint),
  getTooltip: (_context, element) => resolveBpmnGatewayTooltip(element),
}

function resolveBpmnGatewayTooltip(element: BpmnGatewayElement): string {
  const gatewayType = element.data?.gatewayType
  if (gatewayType === 'parallel') return 'Parallel gateway'
  if (gatewayType === 'inclusive') return 'Inclusive gateway'
  if (gatewayType === 'complex') return 'Complex gateway'
  if (gatewayType === 'eventBased') return 'Event-based gateway'
  if (gatewayType === 'parallelEventBased') return 'Parallel event-based gateway'
  return 'Exclusive gateway'
}

function containsBpmnGatewayPoint(element: BpmnGatewayElement, point: ModelerPoint): boolean {
  const halfWidth = element.width / 2
  const halfHeight = element.height / 2
  if (halfWidth <= 0 || halfHeight <= 0) return false
  const centerX = element.x + halfWidth
  const centerY = element.y + halfHeight
  return Math.abs(point.x - centerX) / halfWidth + Math.abs(point.y - centerY) / halfHeight <= 1
}
