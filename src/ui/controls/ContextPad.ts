import type { NovaApp, NovaElementSlots, NovaSchema, NovaSurface, NovaTemplateChildSchema } from '@endge/nova'
import type { NovaTooltipTargetResolver, TooltipInput, TooltipTargetResolution } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type {
  ContextPadApi,
  ContextPadDescriptor,
  ContextPadEntry,
  ContextPadLayoutSlotProps,
  ContextPadPosition,
  ContextPadProps,
  ContextPadResolvedProps,
  ContextPadSlotProps,
  ContextPadTarget,
} from '@/domain/types/controls/context-pad.types'
import type {
  ModelerController,
  ModelerEdgeElement,
  ModelerElement,
  ModelerPluginContext,
  ModelerPoint,
  ModelerRect,
} from '@/domain/types/index'
import type { BpmnParticipantElement } from '@/elements/bpmn/participant/bpmn-participant.types'
import {
  createNovaDecoratedComponentDescriptor,
  Nova,

  NovaComponent,
  NovaComponentNode,

  NovaTemplateRuntime,
  Prop,
} from '@endge/nova'
import {

  NovaUIKit,

} from '@endge/nova-ui-kit'
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { MODELER_CONTEXT } from '@/config/context.config'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
} from '@/config/theme.config'
import { isModelerEdgeElement } from '@/domain/types/index'
import {
  createBpmnBoundaryEventForActivity,
  isBpmnBoundaryAttachableActivity,
} from '@/elements/bpmn/boundary-event/bpmn-boundary-event.factory'
import {
  isBpmnDataAssociationActivityElement,
  isBpmnDataAssociationDataElement,
} from '@/elements/bpmn/data-association/bpmn-data-association.factory'
import {
  isBpmnMessageFlowNode,
  resolveBpmnMessageFlowParticipantId,
} from '@/elements/bpmn/message-flow/bpmn-message-flow.factory'
import {
  addBpmnParticipantLane,
  areBpmnParticipantLaneHeadersVisible,
  BPMN_PARTICIPANT_TYPE,
  canToggleBpmnParticipantSingleLane,
  isElementInsideBpmnParticipantLane,
  removeBpmnParticipantLane,
  toggleBpmnParticipantSingleLane,
} from '@/elements/bpmn/participant/bpmn-participant.factory'
import { MODEL_ELEMENTS_RUNTIME } from '@/plugins/elements/model/ElementsRuntime'

@NovaComponent({
  type: Modeler.ContextPad,
  name: 'ContextPad',
  version: '0.1.0',
  dirtyPolicy: {
    update: ['controller', 'placement', 'offset', 'visible', 'zIndex'],
    render: ['controller', 'visible'],
  },
})
export class ContextPad<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ContextPadResolvedProps, ContextPadApi, Record<string, never>, ContextPadProps, E>
  implements NovaTooltipTargetResolver {
  private readonly _childRuntime: NovaTemplateRuntime<E>
  private _slots: NovaElementSlots = {}
  private _closedForSelectionKey: string | null = null
  private _hovered = false
  private _hoveredEntryId: string | null = null
  private _pressedEntryId: string | null = null
  private _variantMenuOpen = false
  private _colorMenuOpen = false
  private _boundaryEventCounter = 0
  private _disposeVariantMenuLayer?: () => void
  private _disposeColorMenuLayer?: () => void
  private readonly _handleWindowMouseDown = (event: MouseEvent): void => {
    this._closeVariantMenuFromWindowPointer(event)
  }

  private readonly _handleWindowKeyDown = (event: KeyboardEvent): void => {
    if ((!this._variantMenuOpen && !this._colorMenuOpen) || event.key !== 'Escape') {
      return
    }
    event.preventDefault()
    this._closeOpenMenus()
  }

  @Prop.object<ModelerController>()
  declare controller?: ModelerController

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ContextPadDescriptor,
    props: ContextPadResolvedProps,
    options: { componentId?: string, slots?: NovaElementSlots } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this._childRuntime = new NovaTemplateRuntime(this)
    this._slots = options.slots ?? {}
    this.options({
      width: surface.width,
      height: surface.height,
      interactive: props.visible && !this._hasCustomSlots(),
      zIndex: props.zIndex,
    })
    this._setupEvents()
    this._setupWindowEvents()
  }

  static normalizeProps(props: ContextPadProps = {}): ContextPadResolvedProps {
    return {
      controller: props.controller,
      placement: props.placement ?? 'right',
      offset: finiteNumber(props.offset, 12),
      visible: props.visible ?? true,
      zIndex: finiteNumber(props.zIndex, 3000),
    }
  }

  override getApi(): ContextPadApi {
    return {
      close: () => this._close(),
      closeMenus: () => this._closeOpenMenus(),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: ContextPadProps): this {
    super.setProps(patch as Partial<ContextPadResolvedProps>)
    this.props = ContextPad.normalizeProps(this.props)
    this.options({
      width: this.surface.width,
      height: this.surface.height,
      interactive: this.props.visible && !this._hasCustomSlots(),
      zIndex: this.props.zIndex,
    })
    this._syncChild()
    return this
  }

  setSlots(slots: NovaElementSlots = {}): this {
    this._slots = { ...slots }
    this.options({ interactive: this.props.visible && !this._hasCustomSlots() })
    this._syncChild()
    return this
  }

  update(): void {
    super.update()
    this.options({
      width: this.surface.width,
      height: this.surface.height,
      interactive: this.props.visible && !this._hasCustomSlots(),
      zIndex: this.props.zIndex,
    })
    this._syncChild()
  }

  render(): void {
    super.render()
    if (this._hasCustomSlots()) {
      this.renderer.schema([])
      this._syncChild()
      return
    }

    this.renderer.schema(this._createDefaultSchema())
  }

  override containsPoint(x: number, y: number): boolean {
    if (this._hasCustomSlots()) {
      return false
    }
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this._resolveTarget(context) : null
    if (!this.props.visible || !target) {
      return false
    }
    if (!context) {
      return false
    }
    const rect = this._resolvePadRect(context, target)
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
  }

  resolveNovaTooltipTarget(input: { x: number, y: number, event?: MouseEvent }): TooltipTargetResolution | null {
    if (this._hasCustomSlots()) {
      return null
    }
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this._resolveTarget(context) : null
    if (!this.props.visible || !context || !target) {
      return null
    }
    const hit = this._resolveEntryAtPoint(context, target, input.x, input.y)
    if (!hit) {
      return null
    }
    return {
      tooltip: {
        value: hit.entry.title,
        placement: 'bottom',
        delay: 250,
      } as TooltipInput,
      rect: hit.rect,
      targetId: `${this.componentId}:${hit.entry.id}`,
      targetType: 'modeler.context-pad.entry',
      targetProps: {
        entryId: hit.entry.id,
        elementId: target.element.id,
      },
    }
  }

  protected override onUnmount(): void {
    this._teardownWindowEvents()
    this._clearDefaultVariantMenu()
    this._clearDefaultColorMenu()
    this._childRuntime.dispose()
    super.onUnmount()
  }

  private _syncChild(): void {
    if (!this._hasCustomSlots()) {
      this._childRuntime.reconcile([])
      return
    }

    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this._resolveTarget(context) : null
    if (!this.props.visible || !context || !target) {
      this._childRuntime.reconcile([])
      return
    }

    const position = this._resolvePosition(target)
    const entries = this._createEntries(context, target)
    const slotProps: ContextPadSlotProps = {
      target,
      element: target.element,
      context,
      entries,
      position,
      run: entry => this._runEntry(context, target, entry),
      close: () => this._close(),
    }
    const content = this._resolveContent(slotProps)
    const layout = this._resolveLayout({ ...slotProps, content })
    this._childRuntime.reconcile(layout)
  }

  private _resolveTarget(context: ModelerController | ModelerPluginContext): ContextPadTarget | null {
    const model = context.getModel()
    if (model.selection.length !== 1) {
      return null
    }
    const element = model.elements.find(item => item.id === model.selection[0])
    if (!element) {
      return null
    }
    const definition = context.getElementRegistry().get(element.type)
    if (!definition) {
      return null
    }
    if (this._closedForSelectionKey === `${model.id}:${model.selectionVersion}:${element.id}`) {
      return null
    }
    const screenBounds = definition.kind === 'edge' && isModelerEdgeElement(element)
      ? this._resolveEdgeScreenBounds(context, element)
      : this._resolveNodeScreenBounds(context, element)
    if (!screenBounds) {
      return null
    }
    const part = MODEL_ELEMENTS_RUNTIME.contextPadAnchors.getPart(element.id)
    const anchor = definition.kind === 'edge' || part
      ? MODEL_ELEMENTS_RUNTIME.contextPadAnchors.get(element.id)
      : undefined
    if (definition.kind === 'edge' && !anchor && !definition.capabilities?.colorable) {
      return null
    }
    return {
      type: 'element',
      element,
      screenBounds,
      anchor,
      part,
    }
  }

  private _resolveNodeScreenBounds(context: ModelerController | ModelerPluginContext, element: ModelerElement): ModelerRect {
    const topLeft = context.worldToScreen({ x: element.x, y: element.y })
    const bottomRight = context.worldToScreen({
      x: element.x + element.width,
      y: element.y + element.height,
    })
    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    }
  }

  private _resolveEdgeScreenBounds(context: ModelerController | ModelerPluginContext, element: ModelerEdgeElement): ModelerRect | null {
    const pluginContext = resolvePluginContext(context)
    const path = MODEL_ELEMENTS_RUNTIME.edges.createPath(pluginContext, element)
    const points = path.length > 0
      ? path
      : [
          element.source.point,
          ...element.waypoints,
          element.target.point,
        ].filter((point): point is ModelerPoint => Boolean(point))
    if (points.length === 0) {
      return null
    }
    const screenPoints = points.map(point => context.worldToScreen(point))
    const xs = screenPoints.map(point => point.x)
    const ys = screenPoints.map(point => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    }
  }

  private _resolvePosition(target: ContextPadTarget): ContextPadPosition {
    const width = 136
    const height = 40
    const preferredX = (target.anchor?.x ?? target.screenBounds.x + target.screenBounds.width) + this.props.offset
    const preferredY = target.anchor ? target.anchor.y - height / 2 : target.screenBounds.y
    return {
      x: clamp(preferredX, 0, Math.max(0, this.surface.width - width)),
      y: clamp(preferredY, 0, Math.max(0, this.surface.height - height)),
    }
  }

  private _createEntries(
    context: ModelerController | ModelerPluginContext,
    target: ContextPadTarget,
  ): Array<ContextPadEntry> {
    const entries: Array<ContextPadEntry> = []
    const deleteEntries: Array<ContextPadEntry> = []
    if (target.element.type === BPMN_PARTICIPANT_TYPE) {
      const participant = target.element as BpmnParticipantElement
      const lanePart = target.part?.partType === 'bpmn.swimlane.lane' ? target.part : null
      entries.push({
        id: lanePart ? 'swimlane.add-lane-below' : 'swimlane.add-lane',
        title: lanePart ? 'Add lane below' : 'Add lane',
        tone: 'default',
      })
      if (canToggleBpmnParticipantSingleLane(participant)) {
        const laneHeadersVisible = areBpmnParticipantLaneHeadersVisible(participant)
        entries.push({
          id: laneHeadersVisible ? 'swimlane.hide-single-lane' : 'swimlane.show-single-lane',
          title: laneHeadersVisible ? 'Hide single lane' : 'Show single lane',
          tone: 'default',
        })
      }
      if (lanePart && this._canDeleteParticipantLane(context, participant, lanePart.partId)) {
        deleteEntries.push({
          id: 'swimlane.delete-lane',
          title: 'Delete lane',
          tone: 'danger',
        })
      }
    }
    if (isBpmnBoundaryAttachableActivity(target.element)) {
      entries.push({
        id: 'boundary-event.add',
        title: 'Add boundary event',
        tone: 'default',
      })
    }
    if (isBpmnDataAssociationActivityElement(target.element) || isBpmnDataAssociationDataElement(target.element)) {
      entries.push({
        id: 'data-association.connect',
        title: isBpmnDataAssociationDataElement(target.element) ? 'Connect data input' : 'Connect data output',
        tone: 'default',
      })
    }
    const pluginContext = resolvePluginContext(context)
    if (
      isBpmnMessageFlowNode(target.element)
      && resolveBpmnMessageFlowParticipantId(pluginContext.getModel().elements, target.element)
    ) {
      entries.push({
        id: 'message-flow.connect',
        title: 'Connect message flow',
        tone: 'default',
      })
    }
    if (pluginContext.elementVariants.hasProvider(target.element)) {
      entries.push({
        id: 'variants',
        title: 'Change element',
        tone: 'default',
      })
    }
    if (this._isColorable(context, target.element)) {
      const lanePart = target.part?.partType === 'bpmn.swimlane.lane' ? target.part : null
      entries.push({
        id: 'color',
        title: lanePart ? 'Lane color' : 'Fill color',
        tone: 'default',
      })
    }
    if (this._isConnectable(context, target.element)) {
      entries.push({
        id: 'connect',
        title: 'Connect',
        tone: 'default',
      })
    }
    deleteEntries.push({
      id: 'delete',
      title: target.element.type === BPMN_PARTICIPANT_TYPE ? 'Delete pool' : 'Delete element',
      tone: 'danger',
    })
    return [...entries, ...deleteEntries]
  }

  private _resolveContent(slotProps: ContextPadSlotProps): Array<NovaTemplateChildSchema> {
    const slot = this._resolveContentSlot(slotProps.element)
    if (slot) {
      const schema = Nova.trackNode(this, () => slot(slotProps), { mode: 'append' })
      return Array.isArray(schema) ? schema as Array<NovaTemplateChildSchema> : []
    }
    return this._createDefaultContent(slotProps)
  }

  private _resolveLayout(slotProps: ContextPadLayoutSlotProps): Array<NovaTemplateChildSchema> {
    const slot = this._slots.layout
    if (slot) {
      const schema = Nova.trackNode(this, () => slot(slotProps), { mode: 'append' })
      return Array.isArray(schema) ? schema as Array<NovaTemplateChildSchema> : []
    }
    return this._createDefaultLayout(slotProps)
  }

  private _resolveContentSlot(element: ModelerElement): ((props: ContextPadSlotProps) => unknown) | undefined {
    return this._slots[`element-${safeSlotName(element.id)}`]
      ?? this._slots[`type-${safeSlotName(element.type)}`]
      ?? this._slots.default
  }

  private _createDefaultLayout(slotProps: ContextPadLayoutSlotProps): Array<NovaTemplateChildSchema> {
    return [{
      type: NovaUIKit.Flex,
      id: `${this.componentId}:layout`,
      props: {
        position: 'fixed',
        inset: { left: slotProps.position.x, top: slotProps.position.y },
        row: true,
        gap: 4,
        padding: 4,
        width: this._resolvePadWidth(slotProps.entries),
        height: 48,
        zIndex: this.props.zIndex,
        background: this._resolveColor('contextPadBackground'),
        border: {
          color: this._resolveColor('contextPadBorderColor'),
          width: 1,
          radius: 8,
        },
      },
      children: slotProps.content,
    }]
  }

  private _createDefaultContent(slotProps: ContextPadSlotProps): Array<NovaTemplateChildSchema> {
    return slotProps.entries.map(entry => ({
      type: NovaUIKit.Button,
      id: `${this.componentId}:${entry.id}`,
      props: {
        position: 'static',
        width: 40,
        height: 40,
        variant: 'ghost',
        icon: this._resolveEntryIcon(entry),
        iconPlacement: 'only',
        background: 'rgba(0,0,0,0)',
        hoverBackground: entry.tone === 'danger'
          ? this._resolveColor('contextPadDangerHoverBackground')
          : 'rgba(15, 23, 42, 0.08)',
        pressedBackground: entry.tone === 'danger'
          ? this._resolveColor('contextPadDangerPressedBackground')
          : 'rgba(15, 23, 42, 0.12)',
        selected: this._isEntrySelected(entry),
        tooltip: { text: entry.title },
        onPress: () => slotProps.run(entry),
      },
    }))
  }

  private _createDefaultSchema(): NovaSchema {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this._resolveTarget(context) : null
    if (!this.props.visible || !context || !target) {
      return []
    }

    const entries = this._createEntries(context, target)
    const layout = this._resolvePadRect(context, target)
    const schema: NovaSchema = [
      {
        type: 'rect',
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        styles: {
          background: this._resolveColor('contextPadBackground'),
          border: {
            color: this._resolveColor('contextPadBorderColor'),
            width: 1,
            radius: 8,
          },
        },
      },
    ]
    entries.forEach((entry, index) => {
      const rect = this._resolveEntryRect(layout, index)
      const selected = this._isEntrySelected(entry)
      const pressed = this._pressedEntryId === entry.id
      const hovered = this._hoveredEntryId === entry.id || (this._hovered && entries.length === 1)
      schema.push({
        type: 'rect',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        styles: {
          background: pressed
            ? this._resolveEntryPressedBackground(entry)
            : selected
              ? 'rgba(22, 131, 255, 0.16)'
              : hovered
                ? this._resolveEntryHoverBackground(entry)
                : 'rgba(0,0,0,0)',
          border: { color: selected ? '#1683ff' : 'rgba(0,0,0,0)', width: selected ? 1 : 0, radius: 6 },
        },
      })
      schema.push({
        type: 'icon',
        icon: this._resolveEntryIcon(entry),
        x: rect.x + 8,
        y: rect.y + 8,
        width: 24,
        height: 24,
        styles: { opacity: 1 },
      })
    })
    return schema
  }

  private _resolvePadRect(context: ModelerController | ModelerPluginContext, target: ContextPadTarget): ModelerRect {
    const entries = this._createEntries(context, target)
    const position = this._resolvePosition(target)
    return {
      x: position.x,
      y: position.y,
      width: this._resolvePadWidth(entries),
      height: 48,
    }
  }

  private _resolvePadWidth(entries: Array<ContextPadEntry>): number {
    return entries.length * 40 + Math.max(0, entries.length - 1) * 4 + 8
  }

  private _resolveEntryRect(layout: ModelerRect, index: number): ModelerRect {
    return {
      x: layout.x + 4 + index * 44,
      y: layout.y + 4,
      width: 40,
      height: 40,
    }
  }

  private _resolveEntryIcon(entry: ContextPadEntry) {
    if (entry.id === 'swimlane.add-lane' || entry.id === 'swimlane.add-lane-below') {
      return MODELER_ASSETS.icons.rowInsertBottom
    }
    if (entry.id === 'swimlane.hide-single-lane' || entry.id === 'swimlane.show-single-lane') {
      return MODELER_ASSETS.icons.swimlane
    }
    if (entry.id === 'swimlane.delete-lane') {
      return MODELER_ASSETS.icons.trashX
    }
    if (entry.id === 'boundary-event.add') {
      return MODELER_ASSETS.icons.activityEventSubProcess
    }
    if (entry.id === 'data-association.connect') {
      return MODELER_ASSETS.icons.link
    }
    if (entry.id === 'message-flow.connect') {
      return MODELER_ASSETS.icons.message
    }
    if (entry.id === 'variants') {
      return MODELER_ASSETS.icons.tool
    }
    if (entry.id === 'connect') {
      return MODELER_ASSETS.icons.connectArrow
    }
    if (entry.id === 'color') {
      return MODELER_ASSETS.icons.brush
    }
    return MODELER_ASSETS.icons.trash
  }

  private _isEntrySelected(entry: ContextPadEntry): boolean {
    return (entry.id === 'variants' && this._variantMenuOpen) || (entry.id === 'color' && this._colorMenuOpen)
  }

  private _isColorable(context: ModelerController | ModelerPluginContext, element: ModelerElement): boolean {
    const definition = resolvePluginContext(context).getElementRegistry().get(element.type)
    return definition?.capabilities?.colorable !== false
  }

  private _isConnectable(context: ModelerController | ModelerPluginContext, element: ModelerElement): boolean {
    const definition = resolvePluginContext(context).getElementRegistry().get(element.type)
    return Boolean(definition)
      && definition?.capabilities?.connectable !== false
      && definition?.capabilities?.connectable?.outgoing !== false
  }

  private _runEntry(
    context: ModelerController | ModelerPluginContext,
    target: ContextPadTarget,
    entry: ContextPadEntry,
  ): void {
    if (entry.id === 'swimlane.add-lane' || entry.id === 'swimlane.add-lane-below') {
      context.applyCommand({
        type: 'element.replace',
        id: target.element.id,
        element: addBpmnParticipantLane(target.element as BpmnParticipantElement, target.part?.partId),
      })
      this._closeOpenMenus()
      this.dirty({ render: true })
      return
    }
    if (entry.id === 'swimlane.hide-single-lane' || entry.id === 'swimlane.show-single-lane') {
      context.applyCommand({
        type: 'element.replace',
        id: target.element.id,
        element: toggleBpmnParticipantSingleLane(target.element as BpmnParticipantElement),
      })
      this._closeOpenMenus()
      this.dirty({ render: true })
      return
    }
    if (entry.id === 'swimlane.delete-lane') {
      const laneId = target.part?.partId
      if (laneId && this._canDeleteParticipantLane(context, target.element as BpmnParticipantElement, laneId)) {
        context.applyCommand({
          type: 'element.replace',
          id: target.element.id,
          element: removeBpmnParticipantLane(target.element as BpmnParticipantElement, laneId),
        })
      }
      this._closeOpenMenus()
      this.dirty({ render: true })
      return
    }
    if (entry.id === 'boundary-event.add') {
      const element = createBpmnBoundaryEventForActivity(target.element, {
        id: `bpmn-boundary-event-${Date.now().toString(36)}-${this._boundaryEventCounter += 1}`,
      })
      context.applyCommand({ type: 'element.add', element })
      context.applyCommand({ type: 'select', ids: [element.id] })
      this._closeOpenMenus()
      this.dirty({ render: true })
      return
    }
    if (entry.id === 'data-association.connect') {
      this._closeOpenMenus()
      resolvePluginContext(context).actions.run('element.connect.data-association.from-selection')
      this._close()
      return
    }
    if (entry.id === 'message-flow.connect') {
      this._closeOpenMenus()
      resolvePluginContext(context).actions.run('element.connect.message-flow.from-selection')
      this._close()
      return
    }
    if (entry.id === 'variants') {
      this._variantMenuOpen = !this._variantMenuOpen
      if (this._variantMenuOpen) {
        this._closeColorMenu()
        this._syncDefaultVariantMenu()
      }
      else {
        this._clearDefaultVariantMenu()
      }
      this._syncChild()
      this.dirty({ render: true })
      return
    }
    if (entry.id === 'color') {
      this._colorMenuOpen = !this._colorMenuOpen
      if (this._colorMenuOpen) {
        this._closeVariantMenu()
        this._syncDefaultColorMenu()
      }
      else {
        this._clearDefaultColorMenu()
      }
      this._syncChild()
      this.dirty({ render: true })
      return
    }
    if (entry.id === 'connect') {
      this._closeOpenMenus()
      resolvePluginContext(context).actions.run('element.connect.from-selection')
      this._close()
      return
    }
    if (entry.id !== 'delete') {
      return
    }
    context.applyCommand({ type: 'element.delete', id: target.element.id })
    this._close()
  }

  private _close(): void {
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const model = context?.getModel()
    this._closedForSelectionKey = model?.selection.length === 1
      ? `${model.id}:${model.selectionVersion}:${model.selection[0]}`
      : null
    this._variantMenuOpen = false
    this._colorMenuOpen = false
    this._clearDefaultVariantMenu()
    this._clearDefaultColorMenu()
    this._childRuntime.reconcile([])
    this.dirty({ render: true })
  }

  private _syncDefaultVariantMenu(): void {
    if (this._hasCustomSlots()) {
      return
    }
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this._resolveTarget(context) : null
    if (!this._variantMenuOpen || !context || !target) {
      this._clearDefaultVariantMenu()
      return
    }
    const position = this._resolvePosition(target)
    this._clearDefaultVariantMenu()
    this._disposeVariantMenuLayer = resolvePluginContext(context).layers.reconcile('controls', `${this.componentId}:variant-menu`, [{
      type: Modeler.ElementVariantMenu,
      id: `${this.componentId}:variant-menu`,
      props: {
        controller: context,
        elementId: target.element.id,
        part: target.part,
        anchor: position,
        visible: true,
        zIndex: this.props.zIndex + 1,
        onClose: () => {
          this._closeVariantMenu()
        },
      },
    }])
  }

  private _syncDefaultColorMenu(): void {
    if (this._hasCustomSlots()) {
      return
    }
    const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
    const target = context ? this._resolveTarget(context) : null
    if (!this._colorMenuOpen || !context || !target) {
      this._clearDefaultColorMenu()
      return
    }
    const position = this._resolvePosition(target)
    this._clearDefaultColorMenu()
    this._disposeColorMenuLayer = resolvePluginContext(context).layers.reconcile('controls', `${this.componentId}:color-menu`, [{
      type: Modeler.ElementColorMenu,
      id: `${this.componentId}:color-menu`,
      props: {
        controller: context,
        elementId: target.element.id,
        part: target.part,
        anchor: position,
        visible: true,
        zIndex: this.props.zIndex + 1,
        onClose: () => {
          this._closeColorMenu()
        },
      },
    }])
  }

  private _closeVariantMenu(): void {
    if (!this._variantMenuOpen && !this._disposeVariantMenuLayer) {
      return
    }
    this._variantMenuOpen = false
    this._clearDefaultVariantMenu()
    this._syncChild()
    this.dirty({ render: true })
  }

  private _closeColorMenu(): void {
    if (!this._colorMenuOpen && !this._disposeColorMenuLayer) {
      return
    }
    this._colorMenuOpen = false
    this._clearDefaultColorMenu()
    this._syncChild()
    this.dirty({ render: true })
  }

  private _closeOpenMenus(): void {
    this._closeVariantMenu()
    this._closeColorMenu()
  }

  private _clearDefaultVariantMenu(): void {
    this._disposeVariantMenuLayer?.()
    this._disposeVariantMenuLayer = undefined
  }

  private _clearDefaultColorMenu(): void {
    this._disposeColorMenuLayer?.()
    this._disposeColorMenuLayer = undefined
  }

  private _setupWindowEvents(): void {
    if (typeof window === 'undefined') {
      return
    }
    window.addEventListener('mousedown', this._handleWindowMouseDown, true)
    window.addEventListener('keydown', this._handleWindowKeyDown, true)
  }

  private _teardownWindowEvents(): void {
    if (typeof window === 'undefined') {
      return
    }
    window.removeEventListener('mousedown', this._handleWindowMouseDown, true)
    window.removeEventListener('keydown', this._handleWindowKeyDown, true)
  }

  private _closeVariantMenuFromWindowPointer(event: MouseEvent): void {
    if (!this._variantMenuOpen && !this._colorMenuOpen) {
      return
    }
    const { x, y } = this.nova.events.getCanvasMousePosition(event)
    const target = this.nova.events.hitTest(x, y)
    const targetId = target ? String((target as { componentId?: string }).componentId ?? target.id) : ''
    if (targetId === this.componentId || targetId.startsWith(`${this.componentId}:`)) {
      return
    }
    this._closeOpenMenus()
  }

  private _setupEvents(): void {
    this.on('mouseenter', () => {
      this._hovered = true
      this.dirty({ render: true })
    })
    this.on('mousemove', (event) => {
      const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
      const target = context ? this._resolveTarget(context) : null
      if (!context || !target) {
        return
      }
      const hit = this._resolveEntryFromEvent(context, target, event)
      if (hit?.id === this._hoveredEntryId) {
        return
      }
      this._hoveredEntryId = hit?.id ?? null
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this._hovered = false
      this._hoveredEntryId = null
      this._pressedEntryId = null
      this.dirty({ render: true })
    })
    this.on('mousedown', (event) => {
      const context = this.props.controller ?? this.injectOptional(MODELER_CONTEXT)
      const target = context ? this._resolveTarget(context) : null
      const entry = context && target ? this._resolveEntryFromEvent(context, target, event) : null
      if (!context || !target || !entry || this._hasCustomSlots()) {
        return
      }
      this._pressedEntryId = entry.id
      this.dirty({ render: true })
      this._runEntry(context, target, entry)
      return false
    })
    this.on('mouseup', () => {
      if (!this._pressedEntryId) {
        return false
      }
      this._pressedEntryId = null
      this.dirty({ render: true })
      return false
    })
    this.on('keydown', (event) => {
      if ((!this._variantMenuOpen && !this._colorMenuOpen) || event.key !== 'Escape') {
        return
      }
      event.preventDefault()
      this._closeOpenMenus()
      return false
    })
  }

  private _resolveEntryFromEvent(
    context: ModelerController | ModelerPluginContext,
    target: ContextPadTarget,
    event: MouseEvent,
  ): ContextPadEntry | undefined {
    const { x, y } = this.events.getCanvasMousePosition(event)
    return this._resolveEntryAtPoint(context, target, x, y)?.entry
  }

  private _resolveEntryAtPoint(
    context: ModelerController | ModelerPluginContext,
    target: ContextPadTarget,
    x: number,
    y: number,
  ): { entry: ContextPadEntry, rect: ModelerRect } | null {
    const layout = this._resolvePadRect(context, target)
    const entries = this._createEntries(context, target)
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      if (!entry) {
        continue
      }
      const rect = this._resolveEntryRect(layout, index)
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
        return { entry, rect }
      }
    }
    return null
  }

  private _resolveEntryHoverBackground(entry: ContextPadEntry): string {
    return entry.tone === 'danger'
      ? this._resolveColor('contextPadDangerHoverBackground')
      : 'rgba(15, 23, 42, 0.08)'
  }

  private _resolveEntryPressedBackground(entry: ContextPadEntry): string {
    return entry.tone === 'danger'
      ? this._resolveColor('contextPadDangerPressedBackground')
      : 'rgba(15, 23, 42, 0.12)'
  }

  private _canDeleteParticipantLane(
    context: ModelerController | ModelerPluginContext,
    participant: BpmnParticipantElement,
    laneId: string,
  ): boolean {
    if ((participant.data?.lanes?.length ?? 0) <= 1) {
      return false
    }
    return !context.getModel().elements.some(element =>
      element.id !== participant.id
      && !isModelerEdgeElement(element)
      && isElementInsideBpmnParticipantLane(element, participant, laneId),
    )
  }

  private _resolveColor(token: keyof typeof MODELER_THEME_FALLBACKS): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return String(this.nova.theme.resolve(
      MODELER_THEME_TOKENS[token],
      fallback,
    ) ?? fallback)
  }

  private _hasCustomSlots(): boolean {
    return Object.keys(this._slots).length > 0
  }
}

export const MODELER_CONTEXT_PAD_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ContextPadResolvedProps,
  ContextPadApi,
  Record<string, never>,
  ContextPadProps
>(ContextPad as never) as ContextPadDescriptor

function safeSlotName(value: string): string {
  return value.replace(/[^\w-]+/g, '-')
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function resolvePluginContext(context: ModelerController | ModelerPluginContext): ModelerPluginContext {
  return 'getPluginContext' in context ? context.getPluginContext() : context
}
