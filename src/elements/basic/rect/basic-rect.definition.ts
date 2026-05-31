import { Modeler } from '@/config/schema.config'
import type {
  ModelerElementDefinition,
  ModelerElementRenderContext,
} from '@/domain/types/index'
import {
  BASIC_RECT_DEFAULT_HEIGHT,
  BASIC_RECT_DEFAULT_WIDTH,
  BASIC_RECT_MIN_HEIGHT,
  BASIC_RECT_MIN_WIDTH,
  BASIC_RECT_TYPE,
  createBasicRectElement,
} from '@/elements/basic/rect/basic-rect.factory'
import { createBasicRectPorts } from '@/elements/basic/rect/basic-rect.ports'

export const BasicRectDefinition: ModelerElementDefinition = {
  type: BASIC_RECT_TYPE,
  kind: 'node',
  defaults: {
    width: BASIC_RECT_DEFAULT_WIDTH,
    height: BASIC_RECT_DEFAULT_HEIGHT,
  },
  capabilities: {
    selectable: true,
    draggable: true,
    resizable: {
      handles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
      minWidth: BASIC_RECT_MIN_WIDTH,
      minHeight: BASIC_RECT_MIN_HEIGHT,
    },
    rotatable: {
      handleOffset: 28,
      snapDegrees: 15,
    },
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
  normalize: element => createBasicRectElement(element),
  render: (context: ModelerElementRenderContext, element) => ({
    type: Modeler.BasicRectView,
    id: `${element.id}:view`,
    props: {
      element,
      viewport: context.getViewport(),
      selected: context.selected,
    },
  }),
  getPorts: (_context, element) => createBasicRectPorts(element),
}
