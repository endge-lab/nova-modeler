import type { NovaApp, NovaTemplateChildSchema } from '@endge/nova'
import { NovaUIKit } from '@endge/nova-ui-kit'
import { Modeler } from '@/config/schema.config'
import type {
  ModelerEdgeElement,
  ModelerElement,
  ModelerElementDefinition,
  ModelerPluginContext,
  ModelerRect,
  ModelerRenderBand,
  ModelerViewport,
} from '@/domain/types/index'
import { isModelerEdgeElement } from '@/domain/types/index'
import { MODELER_PORT_RADIUS } from '@/plugins/elements/elements.constants'
import type { ElementsRuntime } from '@/plugins/elements/model/ElementsRuntime'
import {
  isBpmnRecipeNodeType,
  isBpmnRecipeRenderableNode,
  normalizeBpmnRecipeRenderingOptions,
  shouldUseBpmnRecipeRendering,
} from '@/ui/layers/BpmnRecipeLayer'

export class ElementsLayer {
  private stableBpmnContainerRecipeElements: Array<ModelerElement> = []
  private stableBpmnNodeRecipeElements: Array<ModelerElement> = []
  private stableBpmnContainerRecipeSignature = ''
  private renderedElementIds = new Set<string>()
  private renderedExternalLabelIds = new Set<string>()
  private renderedOverlayComponentIds = new Set<string>()
  private viewportFastPathWindow: ModelerRect | null = null
  private viewportFastPathScaleBucket = Number.NaN
  private viewportFastPathUseBpmnRecipes = false
  private disposeContainersLayer: (() => void) | undefined
  private disposeLinksLayer: (() => void) | undefined
  private disposeInteractionLayer: (() => void) | undefined
  private disposeWarningLayer: (() => void) | undefined
  private readonly disposeShadow: () => void
  private readonly disposePreview: () => void
  private readonly disposeConnection: () => void
  private readonly disposeSegmentHover: () => void
  private readonly disposeConnectionWarning: () => void
  private readonly disposeExternalLabels: () => void

  constructor(
    private readonly context: ModelerPluginContext,
    private readonly runtime: ElementsRuntime,
  ) {
    this.disposeShadow = this.runtime.dragShadow.subscribe(() => this.sync())
    this.disposePreview = this.runtime.edgePreview.subscribe(() => this.sync())
    this.disposeConnection = this.runtime.connection.subscribe(() => this.sync())
    this.disposeSegmentHover = this.runtime.edgeSegmentHover.subscribe(() => this.sync())
    this.disposeConnectionWarning = this.runtime.connectionWarnings.subscribe(() => this.sync())
    this.disposeExternalLabels = this.context.externalLabels.subscribe(() => this.sync())
  }

  sync(): void {
    const containerSchemas: Array<NovaTemplateChildSchema> = []
    const linkSchemas: Array<NovaTemplateChildSchema> = []
    const interactionSchemas: Array<NovaTemplateChildSchema> = []
    const nodeSchemas: Array<NovaTemplateChildSchema> = []
    const nodeOverlaySchemas: Array<NovaTemplateChildSchema> = []
    const externalLabelSchemas: Array<NovaTemplateChildSchema> = []
    const bpmnRecipeElements: Array<ModelerElement> = []
    const renderedElementIds = new Set<string>()
    const renderedExternalLabelIds = new Set<string>()
    const renderedOverlayComponentIds = new Set<string>()
    const model = this.context.getModel()
    const viewport = this.context.getViewport()
    const layout = this.context.getLayout()
    const options = this.context.getOptions()
    const recipeOptions = normalizeBpmnRecipeRenderingOptions(options)
    const selected = new Set(model.selection)
    const connection = this.runtime.connection.get()
    const connectionTargetId = connection?.targetElementId
    const forcedRecipeNodeIds = new Set<string>()
    if (connection?.sourceElementId) forcedRecipeNodeIds.add(connection.sourceElementId)
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
      layout,
      viewport,
      selectedIds: model.selection,
      connectionTargetId,
      edgeSegmentHoverElementId: segmentHover?.elementId,
      forcedIds: [connection?.sourceElementId],
      useBpmnRecipes,
      recipeCulling: recipeOptions.culling,
      resolveExternalLabelBounds: element => this.context.externalLabels.resolveBounds(this.context, element),
      classifier: {
        isEdge: (element) => this.runtime.edges.isEdge(element),
        isRecipeNodeType: isBpmnRecipeNodeType,
        isRecipeRenderable: (element) => isBpmnRecipeRenderableNode(element),
      },
    })
    const edges = visible.edges
    const nodes = [...visible.schemaNodes].sort(compareNodeRenderOrder)
    for (const element of edges) {
      renderedElementIds.add(element.id)
      this.appendEdgeSchema(linkSchemas, element, selected)
      this.appendEdgeInteractionSchema(interactionSchemas, element, selected, renderedOverlayComponentIds)
      this.appendExternalLabelSchema(externalLabelSchemas, element, renderedExternalLabelIds)
    }
    for (const element of nodes) {
      renderedElementIds.add(element.id)
      const band = this.resolveElementRenderBand(element)
      const schemas = band === 'containers'
        ? containerSchemas
        : band === 'links'
          ? linkSchemas
          : nodeSchemas
      this.appendNodeSchema(schemas, nodeOverlaySchemas, element, selected, connectionTargetId, renderedOverlayComponentIds)
      this.appendExternalLabelSchema(externalLabelSchemas, element, renderedExternalLabelIds)
    }
    bpmnRecipeElements.push(...[...visible.recipeNodes].sort(compareNodeRenderOrder))
    const containerRecipeElements = useBpmnRecipes
      ? model.elements
          .filter(element => this.isRetainedContainerRecipeElement(element, selected, connectionTargetId, forcedRecipeNodeIds))
          .sort(compareNodeRenderOrder)
      : []
    const nodeRecipeElements = bpmnRecipeElements.filter(element => this.resolveElementRenderBand(element) !== 'containers')
    if (containerRecipeElements.length > 0) {
      const stableBpmnRecipeElements = this.resolveStableBpmnRecipeElements('containers', containerRecipeElements)
      containerSchemas.push({
        type: Modeler.BpmnRecipeLayerView,
        id: 'modeler-elements:bpmn-container-recipe-layer',
        props: {
          elements: stableBpmnRecipeElements,
          viewport,
          textMode: recipeOptions.text,
          visibleElements: stableBpmnRecipeElements.length,
          culledElements: 0,
          schemaFallbacks: 0,
        },
      })
    }
    if (nodeRecipeElements.length > 0) {
      const stableBpmnRecipeElements = this.resolveStableBpmnRecipeElements('nodes', nodeRecipeElements)
      nodeSchemas.push({
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
    interactionSchemas.push(...externalLabelSchemas)
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
    this.disposeContainersLayer = this.context.layers.reconcile('containers', 'modeler-elements-containers', containerSchemas)
    this.disposeLinksLayer = this.context.layers.reconcile('links', 'modeler-elements-links', linkSchemas)
    this.disposeInteractionLayer = this.context.layers.reconcile('interaction', 'modeler-elements', interactionSchemas)
    this.renderedElementIds = renderedElementIds
    this.renderedExternalLabelIds = renderedExternalLabelIds
    this.renderedOverlayComponentIds = renderedOverlayComponentIds
    this.viewportFastPathWindow = createViewportOverscanWindow(viewport, layout)
    this.viewportFastPathScaleBucket = createViewportScaleBucket(viewport.scale)
    this.viewportFastPathUseBpmnRecipes = useBpmnRecipes
    this.syncConnectionWarning()
  }

  syncViewport(): void {
    const viewport = this.context.getViewport()
    if (!this.canUseViewportFastPath(viewport)) {
      this.sync()
      return
    }
    const app = this.resolveNovaApp()
    const patch = () => {
      this.patchComponentViewport('modeler-elements:bpmn-container-recipe-layer', viewport, app)
      this.patchComponentViewport('modeler-elements:bpmn-recipe-layer', viewport, app)
      for (const elementId of this.renderedElementIds) {
        this.patchComponentViewport(`${elementId}:view`, viewport, app)
      }
      for (const elementId of this.renderedExternalLabelIds) {
        this.patchComponentViewport(`${elementId}:external-label`, viewport, app)
      }
      for (const componentId of this.renderedOverlayComponentIds) {
        this.patchComponentViewport(componentId, viewport, app)
      }
    }
    if (app) app.raph.kernel.transaction(patch)
    else patch()
  }

  private canUseViewportFastPath(viewport: ModelerViewport): boolean {
    if (!this.viewportFastPathWindow) return false
    if (this.runtime.dragShadow.getElements().length > 0) return false
    if (this.runtime.edgePreview.get()) return false
    if (this.runtime.connection.get()) return false
    if (this.runtime.connectionWarnings.get()) return false
    if (createViewportScaleBucket(viewport.scale) !== this.viewportFastPathScaleBucket) return false
    if (shouldUseBpmnRecipeRendering(this.context.getOptions(), viewport) !== this.viewportFastPathUseBpmnRecipes) return false
    return containsRect(this.viewportFastPathWindow, createViewportWorldRect(viewport, this.context.getLayout()))
  }

  private resolveNovaApp(): NovaApp | null {
    try {
      return this.context.layers.get('interaction')?.nova ?? null
    } catch {
      return null
    }
  }

  private patchComponentViewport(componentId: string, viewport: ModelerViewport, app: NovaApp | null = this.resolveNovaApp()): void {
    const node = app?.components.get(componentId) as { setProps?: (patch: { viewport: ModelerViewport }) => void } | undefined
    node?.setProps?.({ viewport })
  }

  private resolveStableBpmnRecipeElements(kind: 'containers' | 'nodes', elements: Array<ModelerElement>): Array<ModelerElement> {
    const stable = kind === 'containers'
      ? this.stableBpmnContainerRecipeElements
      : this.stableBpmnNodeRecipeElements
    if (kind === 'containers') {
      const nextSignature = createContainerRecipeSignature(elements)
      if (nextSignature === this.stableBpmnContainerRecipeSignature) return stable
      const next = [...elements]
      this.stableBpmnContainerRecipeElements = next
      this.stableBpmnContainerRecipeSignature = nextSignature
      return next
    }
    if (elements.length === stable.length
      && elements.every((element, index) => element === stable[index])) {
      return stable
    }
    const next = [...elements]
    this.stableBpmnNodeRecipeElements = next
    return next
  }

  private isRetainedContainerRecipeElement(
    element: ModelerElement,
    selected: Set<string>,
    connectionTargetId: string | undefined,
    forcedRecipeNodeIds: Set<string>,
  ): boolean {
    return !isModelerEdgeElement(element)
      && isBpmnRecipeRenderableNode(element)
      && !selected.has(element.id)
      && connectionTargetId !== element.id
      && !forcedRecipeNodeIds.has(element.id)
      && this.resolveElementRenderBand(element) === 'containers'
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
    overlayIds: Set<string>,
  ): void {
    if (!selected.has(element.id) || !isModelerEdgeElement(element)) return
    const segmentHover = this.runtime.edgeSegmentHover.get()
    if (segmentHover?.elementId === element.id) {
      overlayIds.add(`${element.id}:segment:${segmentHover.segmentIndex}`)
      schemas.push({
        type: Modeler.EdgeWaypointHandleView,
        id: `${element.id}:segment:${segmentHover.segmentIndex}`,
        props: { handle: segmentHover, viewport: this.context.getViewport() },
      })
    }
    for (const handle of this.runtime.edges.createWaypointHandles(element as ModelerEdgeElement)) {
      overlayIds.add(`${element.id}:waypoint:${handle.waypointIndex}`)
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
    overlayIds?: Set<string>,
  ): void {
    const definition = this.context.getElementRegistry().get(element.type)
    if (!definition) return
    const isSelected = selected.has(element.id)
    schemas.push(definition.render({ ...this.context, selected: isSelected || connectionTargetId === element.id }, element))
    if (!isSelected) return
    const rotateHandle = this.runtime.handles.createRotateHandle(element, definition)
    if (rotateHandle) {
      overlayIds?.add(`${element.id}:rotate`)
      overlaySchemas.push({
        type: Modeler.RotateHandleView,
        id: `${element.id}:rotate`,
        props: { handle: rotateHandle, viewport: this.context.getViewport() },
      })
    }
    for (const handle of this.runtime.handles.createResizeHandles(element, definition)) {
      overlayIds?.add(`${element.id}:resize:${handle.handle}`)
      overlaySchemas.push({
        type: Modeler.ResizeHandleView,
        id: `${element.id}:resize:${handle.handle}`,
        props: { handle, viewport: this.context.getViewport() },
      })
    }
    if (definition.capabilities?.ports === false) return
    for (const port of this.runtime.ports.createElementPorts(element, definition.getPorts?.(this.context, element) ?? [])) {
      overlayIds?.add(`${element.id}:port:${port.id}`)
      overlaySchemas.push({
        type: Modeler.PortView,
        id: `${element.id}:port:${port.id}`,
        props: { port, viewport: this.context.getViewport(), radius: MODELER_PORT_RADIUS },
      })
    }
  }

  private appendExternalLabelSchema(
    schemas: Array<NovaTemplateChildSchema>,
    element: ModelerElement,
    renderedIds: Set<string>,
  ): void {
    const definition = this.context.getElementRegistry().get(element.type)
    if (!definition?.externalLabel) return
    const layout = this.context.externalLabels.resolve(this.context, element)
    if (!layout) return
    if (!layout.text && !this.context.externalLabels.isSelected(element.id)) return
    renderedIds.add(element.id)
    schemas.push({
      type: Modeler.ExternalLabelView,
      id: `${element.id}:external-label`,
      props: {
        layout,
        viewport: this.context.getViewport(),
        selected: this.context.externalLabels.isSelected(element.id),
      },
    })
  }

  private resolveElementRenderBand(element: ModelerElement): ModelerRenderBand {
    const definition = this.context.getElementRegistry().get(element.type)
    if (!definition) return 'nodes'
    return resolveElementRenderBand(this.context, definition, element)
  }

  dispose(): void {
    this.disposeShadow()
    this.disposePreview()
    this.disposeConnection()
    this.disposeSegmentHover()
    this.disposeConnectionWarning()
    this.disposeExternalLabels()
    this.disposeContainersLayer?.()
    this.disposeLinksLayer?.()
    this.disposeInteractionLayer?.()
    this.disposeWarningLayer?.()
    this.disposeContainersLayer = undefined
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
  return 0
}

function createContainerRecipeSignature(elements: Array<ModelerElement>): string {
  return elements.map(element => {
    const data = element.data as Record<string, any> | undefined
    const style = element.style as Record<string, any> | undefined
    const lanes = Array.isArray(data?.lanes)
      ? data.lanes.map((lane: Record<string, any>) => [
          lane.id,
          lane.name,
          lane.size,
          lane.style?.fill,
          lane.style?.stroke,
        ].join(':')).join(',')
      : ''
    return [
      element.id,
      element.type,
      element.x,
      element.y,
      element.width,
      element.height,
      element.rotation ?? 0,
      element.zIndex ?? 0,
      data?.name,
      data?.hideName,
      data?.orientation,
      style?.fill,
      style?.stroke,
      style?.strokeWidth,
      lanes,
    ].join('|')
  }).join('||')
}

function createViewportWorldRect(viewport: ModelerViewport, layout: { width: number; height: number }): ModelerRect {
  const scale = Math.max(0.0001, viewport.scale)
  return {
    x: -viewport.x / scale,
    y: -viewport.y / scale,
    width: layout.width / scale,
    height: layout.height / scale,
  }
}

function createViewportOverscanWindow(viewport: ModelerViewport, layout: { width: number; height: number }): ModelerRect {
  const rect = createViewportWorldRect(viewport, layout)
  return {
    x: rect.x - rect.width,
    y: rect.y - rect.height,
    width: rect.width * 3,
    height: rect.height * 3,
  }
}

function createViewportScaleBucket(scale: number): number {
  return Math.round(Math.log2(Math.max(0.0001, scale)) * 2)
}

function containsRect(outer: ModelerRect, inner: ModelerRect): boolean {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
}

function resolveElementRenderBand(
  context: ModelerPluginContext,
  definition: ModelerElementDefinition,
  element: ModelerElement,
): ModelerRenderBand {
  const band = typeof definition.renderBand === 'function'
    ? definition.renderBand(context, element)
    : definition.renderBand
  if (band) return band
  return definition.kind === 'edge' ? 'links' : 'nodes'
}
