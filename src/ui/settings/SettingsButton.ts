import {
  Nova,
  NovaComponent,
  NovaComponentNode,
  NovaTemplateRuntime,
  Prop,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaElementSlots,
  type NovaSchema,
  type NovaSurface,
  type NovaTemplateChildSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import {
  NOVA_UI_LAYOUT_TARGET,
  NovaUIKit,
  findNovaUiRoot,
  type NovaUiLayoutConstraints,
  type NovaUiLayoutMeasure,
  type NovaUiLayoutRect,
  type RootApi,
} from '@endge/nova-ui-kit'
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { Modeler } from '@/config/schema.config'
import {
  createModelerSettingsController,
} from '@/model/settings/ModelerSettingsController'
import type {
  ModelerSettingsButtonApi,
  ModelerSettingsButtonDescriptor,
  ModelerSettingsButtonProps,
  ModelerSettingsButtonResolvedProps,
  ModelerSettingsButtonSlotProps,
  ModelerSettingsDialogPayload,
} from '@/domain/types'

@NovaComponent({
  type: Modeler.SettingsButton,
  name: 'SettingsButton',
  version: '0.1.0',
  dirtyPolicy: {
    matrix: ['x', 'y', 'zIndex'],
    update: ['width', 'height', 'position', 'inset', 'visible', 'zIndex'],
    render: ['payload', 'payloadFactory', 'visible'],
  },
})
export class SettingsButton<E extends EventList = Record<string, any>>
  extends NovaComponentNode<ModelerSettingsButtonResolvedProps, ModelerSettingsButtonApi, Record<string, never>, ModelerSettingsButtonProps, E> {
  readonly [NOVA_UI_LAYOUT_TARGET] = true as const

  private readonly childRuntime: NovaTemplateRuntime<E>
  private slots: NovaElementSlots = {}
  private externalLayout = false

  @Prop.object<ModelerSettingsDialogPayload>()
  declare payload?: ModelerSettingsDialogPayload

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: ModelerSettingsButtonDescriptor,
    props: ModelerSettingsButtonResolvedProps,
    options: { componentId?: string; slots?: NovaElementSlots } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.childRuntime = new NovaTemplateRuntime(this)
    this.slots = options.slots ?? {}
    this.options({
      width: props.width,
      height: props.height,
      interactive: props.visible,
      zIndex: props.zIndex,
    })
    this.setupEvents()
    this.syncChild()
  }

  static normalizeProps(props: ModelerSettingsButtonProps = {}): ModelerSettingsButtonResolvedProps {
    return {
      payload: props.payload,
      payloadFactory: props.payloadFactory,
      rootId: props.rootId,
      type: props.type,
      dialogId: props.dialogId,
      position: props.position ?? 'static',
      inset: props.inset,
      width: Math.max(1, finiteNumber(props.width, 36)),
      height: Math.max(1, finiteNumber(props.height, 36)),
      size: props.size ?? 'md',
      zIndex: props.zIndex,
      visible: props.visible ?? true,
    }
  }

  override getApi(): ModelerSettingsButtonApi {
    return {
      open: event => this.open(event),
      close: event => this.close(event),
      toggle: event => this.toggle(event),
      isOpen: () => this.isOpen(),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: ModelerSettingsButtonProps): this {
    super.setProps(patch as Partial<ModelerSettingsButtonResolvedProps>)
    this.props = SettingsButton.normalizeProps(this.props)
    if (!this.externalLayout) this.syncFrame()
    this.syncChild()
    return this
  }

  setSlots(slots: NovaElementSlots = {}): this {
    this.slots = { ...slots }
    this.syncChild()
    return this
  }

  applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    this.externalLayout = true
    const sizeChanged = this.width !== rect.width || this.height !== rect.height
    const changed = this.x !== rect.x || this.y !== rect.y || sizeChanged
    this.options({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
    if (changed) this.dirty({ matrix: true, update: sizeChanged, render: true })
    this.syncChild()
    return changed
  }

  measureLayout(_constraints: NovaUiLayoutConstraints): NovaUiLayoutMeasure {
    return { width: this.props.width, height: this.props.height }
  }

  update(): void {
    super.update()
    if (!this.externalLayout) this.syncFrame()
    this.syncChild()
  }

  render(): void {
    super.render()
    this.renderer.schema(this.props.visible
      ? [{
          type: 'rect',
          x: 0,
          y: 0,
          width: this.width,
          height: this.height,
          styles: {
            background: 'rgba(0,0,0,0)',
            border: { color: 'rgba(0,0,0,0)', width: 0, radius: 0 },
          },
        }] as NovaSchema
      : [] as unknown as NovaSchema)
    this.syncChild()
  }

  protected override onUnmount(): void {
    this.childRuntime.dispose()
    super.onUnmount()
  }

  private open(event?: Event): void {
    this.createController().open(this.createPayload())
    this.dirty({ render: true })
    event?.preventDefault?.()
  }

  private close(event?: Event): void {
    this.createController().close(event)
    this.dirty({ render: true })
  }

  private toggle(event?: Event): void {
    this.createController().toggle(this.createPayload(), event)
    this.dirty({ render: true })
  }

  private isOpen(): boolean {
    return this.createController().isOpen()
  }

  private createController() {
    return createModelerSettingsController({
      root: () => this.resolveRootApi(),
      type: this.props.type,
      id: this.props.dialogId,
    })
  }

  private createPayload(): ModelerSettingsDialogPayload {
    const payload = this.props.payloadFactory?.() ?? this.props.payload ?? {}
    const userOpenChange = payload.onOpenChange as ((open: boolean, event?: Event) => void) | undefined
    return {
      ...payload,
      onOpenChange: (open: boolean, event?: Event) => {
        userOpenChange?.(open, event)
        this.dirty({ render: true })
        this.syncChild()
      },
    }
  }

  private resolveRootApi(): RootApi | null {
    return findNovaUiRoot(this)?.getApi?.()
      ?? (this.props.rootId ? this.nova.components.api<RootApi>(this.props.rootId) : undefined)
      ?? null
  }

  private syncChild(): void {
    if (!this.props.visible) {
      this.childRuntime.reconcile([])
      return
    }
    const slotProps: ModelerSettingsButtonSlotProps = {
      selected: this.isOpen(),
      toggle: event => this.toggle(event),
      open: event => this.open(event),
      close: event => this.close(event),
    }
    const custom = this.slots.default
    if (custom) {
      const schema = Nova.trackNode(this, () => custom(slotProps), { mode: 'append' })
      this.childRuntime.reconcile(normalizeChildren(schema))
      return
    }
    this.childRuntime.reconcile([{
      type: NovaUIKit.Button,
      id: `${this.componentId}:button`,
      props: {
        icon: MODELER_ASSETS.icons.settings,
        iconPlacement: 'only',
        position: 'static',
        size: this.props.size,
        width: this.width,
        height: this.height,
        selected: slotProps.selected,
        onPress: (event?: Event) => this.toggle(event),
      },
    }])
  }

  private syncFrame(): void {
    this.options({
      width: this.props.width,
      height: this.props.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
  }

  private setupEvents(): void {
    this.on('mousedown', event => {
      this.toggle(event)
      return false
    })
  }
}

export const MODELER_SETTINGS_BUTTON_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  ModelerSettingsButtonResolvedProps,
  ModelerSettingsButtonApi,
  Record<string, never>,
  ModelerSettingsButtonProps
>(SettingsButton as never) as ModelerSettingsButtonDescriptor

function normalizeChildren(schema: unknown): Array<NovaTemplateChildSchema> {
  return Array.isArray(schema) ? schema as Array<NovaTemplateChildSchema> : []
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
