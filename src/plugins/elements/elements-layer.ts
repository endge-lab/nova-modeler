import type { NovaTemplateChildSchema } from '@endge/nova'
import { NovaUIKit } from '@endge/nova-ui-kit'
import { Modeler } from '@/config/schema.config'
import type {
  ModelerEdgeElement,
  ModelerElement,
  ModelerPluginContext,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { BPMN_PARTICIPANT_TYPE } from '@/elements/bpmn/participant/bpmn-participant.factory'
import { MODELER_PORT_RADIUS } from '@/plugins/elements/elements.constants'
import type { ElementsRuntime } from '@/plugins/elements/model/ElementsRuntime'
import {
  isBpmnRecipeNodeType,
  isBpmnRecipeRenderableNode,
  normalizeBpmnRecipeRenderingOptions,
  shouldUseBpmnRecipeRendering,
} from '@/ui/layers/BpmnRecipeLayer'

export class ElementsLayer {
  private stableBpmnRecipeElements: Array<ModelerElement> = []
  private disposeLinksLayer: (() => void) | undefined
  private disposeInteractionLayer: (() => void) | undefined
  private disposeWarningLayer: (() => void) | undefined
  private readonly disposeShadow: () => void
  private readonly disposePreview: () => void
  private readonly disposeConnection: () => void
  private readonly disposeSegmentHover: () => void
  private readonly disposeConnectionWarning: () => void

  constructor(
    private readonly context: ModelerPluginContext,
    private readonly runtime: ElementsRuntime,
  ) {
    this.disposeShadow = this.runtime.dragShadow.subscribe(() => this.sync())
    this.disposePreview = this.runtime.edgePreview.subscribe(() => this.sync())
    this.disposeConnection = this.runtime.connection.subscribe(() => this.sync())
    this.disposeSegmentHover = this.runtime.edgeSegmentHover.subscribe(() => this.sync())
    this.disposeConnectionWarning = this.runtime.connectionWarnings.subscribe(() => this.sync())
  }

  sync(): void {
    const linkSchemas: Array<NovaTemplateChildSchema> = []
    const interactionSchemas: Array<NovaTemplateChildSchema> = []
    const nodeSchemas: Array<NovaTemplateChildSchema> = []
    const nodeOverlaySchemas: Array<NovaTemplateChildSchema> = []
    const bpmnRecipeElements: Array<ModelerElement> = []
    const model = this.context.getModel()
    const viewport = this.context.getViewport()
    const options = this.context.getOptions()
    const recipeOptions = normalizeBpmnRecipeRenderingOptions(options)
    const selected = new Set(model.selection)
    const connection = this.runtime.connection.get()
    const connectionTargetId = connection?.targetElementId
    const segmentHover = this.runtime.edgeSegmentHover.get()
    const useBpmnRecipes = shouldUseBpmnRecipeRendering(options, viewport)
    if (options.interaction?.dragShadow !== false) {
      for (const element of this.runtime.dragShadow.getElements()) {
        const definition = this.context.getElementRegistry().get(element.type)
        if (!definition) continue
        interactionSchemas.push(this.createShadowSchema(definition.render({
          ...this.context,
          selected: false,
        }, this.createShadowElement(element))))
      }
    }
    const visible = this.context.visibility.resolve({
      model,
      layout: this.context.getLayout(),
      viewport,
      selectedIds: model.selection,
      connectionTargetId,
      edgeSegmentHoverElementId: segmentHover?.elementId,
      forcedIds: [connection?.sourceElementId],
      useBpmnRecipes,
      recipeCulling: recipeOptions.culling,
      classifier: {
        isEdge: (element) => this.runtime.edges.isEdge(element),
        isRecipeNodeType: isBpmnRecipeNodeType,
        isRecipeRenderable: (element) => element.type !== BPMN_PARTICIPANT_TYPE && isBpmnRecipeRenderableNode(element),
      },
    })
    const edges = visible.edges
    const nodes = [...visible.schemaNodes].sort(compareNodeRenderOrder)
    for (const element of edges) {
      this.appendEdgeSchema(linkSchemas, element, selected)
      this.appendEdgeInteractionSchema(interactionSchemas, element, selected)
    }
    for (const element of nodes) {
      this.appendNodeSchema(nodeSchemas, nodeOverlaySchemas, element, selected, connectionTargetId)
    }
    bpmnRecipeElements.push(...visible.recipeNodes)
    if (bpmnRecipeElements.length > 0) {
      const stableBpmnRecipeElements = this.resolveStableBpmnRecipeElements(bpmnRecipeElements)
      interactionSchemas.push({
        type: Modeler.BpmnRecipeLayerView,
        id: 'modeler-elements:bpmn-recipe-layer',
        props: {
          elements: stableBpmnRecipeElements,
          viewport,
          textMode: recipeOptions.text,
          visibleElements: stableBpmnRecipeElements.length,
          culledElements: visible.culledRecipeElements,
          schemaFallbacks: visible.schemaFallbacks,
        },
      })
    }
    interactionSchemas.push(...nodeSchemas)
    interactionSchemas.push(...nodeOverlaySchemas)
    const preview = this.runtime.edgePreview.get()
    if (preview) {
      const definition = this.context.getElementRegistry().get(preview.type)
      if (definition) {
        linkSchemas.push(definition.render({ ...this.context, selected: false }, preview))
        const schema = linkSchemas[linkSchemas.length - 1] as NovaTemplateChildSchema & { props?: Record<string, unknown> }
        schema.id = `${preview.id}:preview`
        schema.props = { ...(schema.props ?? {}), preview: true }
      }
    }
    this.disposeLinksLayer = this.context.layers.reconcile('links', 'modeler-elements-links', linkSchemas)
    this.disposeInteractionLayer = this.context.layers.reconcile('interaction', 'modeler-elements', interactionSchemas)
    this.syncConnectionWarning()
    this.context.invalidate('render')
  }

  private resolveStableBpmnRecipeElements(elements: Array<ModelerElement>): Array<ModelerElement> {
    if (elements.length === this.stableBpmnRecipeElements.length
      && elements.every((element, index) => element === this.stableBpmnRecipeElements[index])) {
      return this.stableBpmnRecipeElements
    }
    this.stableBpmnRecipeElements = [...elements]
    return this.stableBpmnRecipeElements
  }

  private appendEdgeSchema(
    schemas: Array<NovaTemplateChildSchema>,
    element: ModelerElement,
    selected: Set<string>,
  ): void {
    const definition = this.context.getElementRegistry().get(element.type)
    if (!definition) return
    schemas.push(definition.render({ ...this.context, selected: selected.has(element.id) }, element))
  }

  private appendEdgeInteractionSchema(
    schemas: Array<NovaTemplateChildSchema>,
    element: ModelerElement,
    selected: Set<string>,
  ): void {
    if (!selected.has(element.id) || !isModelerEdgeElement(element)) return
    const segmentHover = this.runtime.edgeSegmentHover.get()
    if (segmentHover?.elementId === element.id) {
      schemas.push({
        type: Modeler.EdgeWaypointHandleView,
        id: `${element.id}:segment:${segmentHover.segmentIndex}`,
        props: { handle: segmentHover, viewport: this.context.getViewport() },
      })
    }
    for (const handle of this.runtime.edges.createWaypointHandles(element as ModelerEdgeElement)) {
      schemas.push({
        type: Modeler.EdgeWaypointHandleView,
        id: `${element.id}:waypoint:${handle.waypointIndex}`,
        props: { handle, viewport: this.context.getViewport() },
      })
    }
  }

  private appendNodeSchema(
    schemas: Array<NovaTemplateChildSchema>,
    overlaySchemas: Array<NovaTemplateChildSchema>,
    element: ModelerElement,
    selected: Set<string>,
    connectionTargetId?: string,
  ): void {
    const definition = this.context.getElementRegistry().get(element.type)
    if (!definition) return
    const isSelected = selected.has(element.id)
    schemas.push(definition.render({ ...this.context, selected: isSelected || connectionTargetId === element.id }, element))
    if (!isSelected) return
    const rotateHandle = this.runtime.handles.createRotateHandle(element, definition)
    if (rotateHandle) {
      overlaySchemas.push({
        type: Modeler.RotateHandleView,
        id: `${element.id}:rotate`,
        props: { handle: rotateHandle, viewport: this.context.getViewport() },
      })
    }
    for (const handle of this.runtime.handles.createResizeHandles(element, definition)) {
      overlaySchemas.push({
        type: Modeler.ResizeHandleView,
        id: `${element.id}:resize:${handle.handle}`,
        props: { handle, viewport: this.context.getViewport() },
      })
    }
    if (definition.capabilities?.ports === false) return
    for (const port of this.runtime.ports.createElementPorts(element, definition.getPorts?.(this.context, element) ?? [])) {
      overlaySchemas.push({
        type: Modeler.PortView,
        id: `${element.id}:port:${port.id}`,
        props: { port, viewport: this.context.getViewport(), radius: MODELER_PORT_RADIUS },
      })
    }
  }

  dispose(): void {
    this.disposeShadow()
    this.disposePreview()
    this.disposeConnection()
    this.disposeSegmentHover()
    this.disposeConnectionWarning()
    this.disposeLinksLayer?.()
    this.disposeInteractionLayer?.()
    this.disposeWarningLayer?.()
    this.disposeLinksLayer = undefined
    this.disposeInteractionLayer = undefined
    this.disposeWarningLayer = undefined
  }

  private syncConnectionWarning(): void {
    const warning = this.runtime.connectionWarnings.get()
    if (!warning) {
      this.disposeWarningLayer?.()
      this.disposeWarningLayer = undefined
      return
    }
    const layout = this.context.getLayout()
    const width = Math.min(392, Math.max(280, layout.width - 32))
    const height = 148
    const x = Math.max(16, Math.round((layout.width - width) / 2))
    const y = Math.max(16, Math.round((layout.height - height) / 2))
    this.disposeWarningLayer = this.context.layers.reconcile('controls', 'modeler-elements-connection-warning', [
      {
        type: 'rect',
        id: `${warning.id}:dimmer`,
        x: 0,
        y: 0,
        width: layout.width,
        height: layout.height,
        styles: {
          background: 'rgba(15, 23, 42, 0.22)',
        },
      },
      {
        type: NovaUIKit.Flex,
        id: `${warning.id}:dialog`,
        props: {
          position: 'fixed',
          inset: { left: x, top: y },
          width,
          height,
          col: true,
          gap: 10,
          padding: { top: 18, right: 18, bottom: 16, left: 18 },
          zIndex: 4200,
          background: '#ffffff',
          border: {
            color: 'rgba(15, 23, 42, 0.14)',
            width: 1,
            radius: 10,
          },
        },
        children: [
          {
            type: NovaUIKit.TextBlock,
            id: `${warning.id}:title`,
            props: {
              position: 'static',
              width: width - 36,
              height: 24,
              text: warning.title,
              fontSize: 16,
              fontWeight: '800',
              color: '#172033',
            },
          },
          {
            type: NovaUIKit.TextBlock,
            id: `${warning.id}:message`,
            props: {
              position: 'static',
              width: width - 36,
              height: 42,
              text: warning.message,
              fontSize: 13,
              lineHeight: 18,
              color: '#4b5563',
            },
          },
          {
            type: NovaUIKit.Flex,
            id: `${warning.id}:footer`,
            props: {
              position: 'static',
              row: true,
              justifyContent: 'end',
              alignItems: 'center',
              width: width - 36,
              height: 34,
            },
            children: [{
              type: NovaUIKit.Button,
              id: `${warning.id}:ok`,
              props: {
                position: 'static',
                width: 76,
                height: 34,
                text: 'OK',
                variant: 'primary',
                onPress: () => {
                  this.runtime.connectionWarnings.clear()
                },
              },
            }],
          },
        ],
      },
    ])
  }

  private createShadowElement(element: ModelerElement): ModelerElement {
    const opacity = typeof element.style?.opacity === 'number' ? element.style.opacity : 1
    return {
      ...element,
      data: { ...element.data },
      style: {
        ...element.style,
        opacity: opacity * 0.225,
      },
    }
  }

  private createShadowSchema(schema: NovaTemplateChildSchema): NovaTemplateChildSchema {
    return this.rekeySchema(schema, 'shadow')
  }

  private rekeySchema(schema: NovaTemplateChildSchema, segment: string): NovaTemplateChildSchema {
    const next = { ...schema } as NovaTemplateChildSchema & { id?: string; children?: Array<NovaTemplateChildSchema> }
    if (typeof next.id === 'string') next.id = `${next.id}:${segment}`
    if (Array.isArray(next.children)) {
      next.children = next.children.map(child => this.rekeySchema(child, segment))
    }
    return next
  }
}

function compareNodeRenderOrder(a: ModelerElement, b: ModelerElement): number {
  const zIndexDelta = (a.zIndex ?? 0) - (b.zIndex ?? 0)
  if (zIndexDelta !== 0) return zIndexDelta
  const backgroundDelta = resolveNodeBackgroundRank(a) - resolveNodeBackgroundRank(b)
  if (backgroundDelta !== 0) return backgroundDelta
  return 0
}

function resolveNodeBackgroundRank(element: ModelerElement): number {
  return element.type === BPMN_PARTICIPANT_TYPE ? -1 : 0
}
