import {
  NovaComponent,
  NovaComponentNode,
  NovaTemplateRuntime,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaComponentDescriptor,
  type NovaCursorDeclaration,
  type NovaSchema,
  type NovaSurface,
  type NovaTemplateChildSchema,
} from '@endge/nova'
import { NovaUIKit } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_THEME_FALLBACKS,
  MODELER_THEME_TOKENS,
} from '@/config/theme.config'
import type {
  ModelerController,
  ModelerPluginContext,
} from '@/domain/types'
import { MODELER_CONTEXT } from '@/config/context.config'

export interface DownloadControlsProps {
  controller?: ModelerController | null
  visible?: boolean
  offset?: number
  zIndex?: number
}

export interface DownloadControlsResolvedProps {
  controller: ModelerController | null
  visible: boolean
  offset: number
  zIndex: number
}

export interface DownloadControlsApi {
  open(): void
  close(): void
  toggle(): void
  setProps(patch: DownloadControlsProps): void
  getProps(): Readonly<DownloadControlsResolvedProps>
}

export type DownloadControlsDescriptor = NovaComponentDescriptor<
  DownloadControlsResolvedProps,
  DownloadControlsApi,
  Record<string, never>,
  DownloadControlsProps
>

interface DownloadMenuItemLayout {
  id: string
  label: string
  icon: ModelerIconAsset
  actionId: string
  x: number
  y: number
  width: number
  height: number
}

type ModelerIconAsset = (typeof MODELER_ASSETS.icons)[keyof typeof MODELER_ASSETS.icons]

const BUTTON_SIZE = 28
const BUTTON_ICON_SIZE = 18
const BUTTON_PANEL_PADDING = 4
const BUTTON_PANEL_SIZE = BUTTON_SIZE + BUTTON_PANEL_PADDING * 2
const MENU_WIDTH = 164
const MENU_ITEM_HEIGHT = 36
const MENU_PADDING = 6
const MENU_GAP = 6
const MENU_ITEMS = [
  { id: 'bpmn', label: 'Скачать BPMN', icon: MODELER_ASSETS.icons.taskScript, actionId: 'modeler.export.bpmn' },
  { id: 'png', label: 'Скачать PNG', icon: MODELER_ASSETS.icons.download, actionId: 'modeler.export.png' },
]

const DOWNLOAD_CONTROLS_CURSOR_RULES: NovaCursorDeclaration = [
  { when: { downloadControlsCursor: 'button' }, use: 'pointer' },
  { use: 'default' },
]

@NovaComponent({
  type: Modeler.DownloadControls,
  name: 'DownloadControls',
  version: '0.1.0',
  dirtyPolicy: {
    matrix: ['x', 'y', 'zIndex'],
    update: ['visible', 'offset', 'zIndex'],
    render: ['visible'],
  },
})
export class DownloadControls<E extends EventList = Record<string, any>>
  extends NovaComponentNode<DownloadControlsResolvedProps, DownloadControlsApi, Record<string, never>, DownloadControlsProps, E> {
  private readonly childRuntime: NovaTemplateRuntime<E>
  private openMenu = false
  private hoveredItemId: string | null = null
  private hoveredButton = false

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: DownloadControlsDescriptor,
    props: DownloadControlsResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.childRuntime = new NovaTemplateRuntime(this)
    this.options({
      interactive: props.visible,
      zIndex: props.zIndex,
      cursor: DOWNLOAD_CONTROLS_CURSOR_RULES,
      cursorContext: { downloadControlsCursor: 'none' },
    })
    this.syncFrame()
    this.setupEvents()
  }

  static normalizeProps(props: DownloadControlsProps = {}): DownloadControlsResolvedProps {
    return {
      controller: props.controller ?? null,
      visible: props.visible ?? true,
      offset: Math.max(0, finiteNumber(props.offset, 16)),
      zIndex: Math.round(finiteNumber(props.zIndex, 3000)),
    }
  }

  override getApi(): DownloadControlsApi {
    return {
      open: () => this.setOpen(true),
      close: () => this.setOpen(false),
      toggle: () => this.setOpen(!this.openMenu),
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
  }

  override setProps(patch: DownloadControlsProps): this {
    super.setProps(patch as Partial<DownloadControlsResolvedProps>)
    this.props = DownloadControls.normalizeProps(this.props)
    this.syncFrame()
    return this
  }

  update(): void {
    super.update()
    this.syncFrame()
  }

  render(): void {
    super.render()
    if (!this.props.visible) {
      this.renderer.schema([])
      this.childRuntime.reconcile([])
      return
    }
    const schema: NovaSchema = []
    if (this.openMenu) this.appendMenu(schema)
    this.appendButtonPanel(schema)
    this.renderer.schema(schema)
    this.syncChild()
  }

  protected override onUnmount(): void {
    this.childRuntime.dispose()
    super.onUnmount()
  }

  private setupEvents(): void {
    this.on('mouseenter', event => {
      this.syncHover(event)
    })
    this.on('mousemove', event => {
      this.syncHover(event)
    })
    this.on('mouseleave', () => {
      this.hoveredButton = false
      this.hoveredItemId = null
      this.setCursor(null)
      this.dirty({ render: true })
    })
    this.on('mousedown', event => {
      if (!this.props.visible) return false
      const point = this.events.getCanvasMousePosition(event)
      const [localX, localY] = this.toLocal(point.x, point.y)
      if (this.containsButton(localX, localY)) {
        this.setOpen(!this.openMenu)
        return false
      }
      const item = this.resolveMenuItem(localX, localY)
      if (item) {
        this.runMenuAction(item)
        this.setOpen(false)
        return false
      }
      this.setOpen(false)
      return false
    })
  }

  private syncHover(event: MouseEvent): void {
    if (!this.props.visible) return
    const point = this.events.getCanvasMousePosition(event)
    const [localX, localY] = this.toLocal(point.x, point.y)
    const nextButton = this.containsButton(localX, localY)
    const nextItemId = this.resolveMenuItem(localX, localY)?.id ?? null
    if (nextButton === this.hoveredButton && nextItemId === this.hoveredItemId) return
    this.hoveredButton = nextButton
    this.hoveredItemId = nextItemId
    this.setCursor(nextButton || !!nextItemId ? 'button' : null)
    this.dirty({ render: true })
  }

  private setOpen(open: boolean): void {
    if (this.openMenu === open) return
    this.openMenu = open
    this.hoveredItemId = null
    this.syncFrame()
    this.dirty({ matrix: true, update: true, render: true })
  }

  private syncFrame(): void {
    const size = this.resolveSize()
    this.options({
      x: this.props.offset,
      y: Math.max(0, this.surface.height - this.props.offset - size.height),
      width: size.width,
      height: size.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
  }

  private resolveSize(): { width: number; height: number } {
    const menuHeight = this.resolveMenuHeight()
    return {
      width: this.openMenu ? Math.max(MENU_WIDTH, BUTTON_PANEL_SIZE) : BUTTON_PANEL_SIZE,
      height: this.openMenu ? menuHeight + MENU_GAP + BUTTON_PANEL_SIZE : BUTTON_PANEL_SIZE,
    }
  }

  private appendButtonPanel(schema: NovaSchema): void {
    const y = this.resolveButtonY()
    schema.push({
      type: 'rect',
      x: 0,
      y,
      width: BUTTON_PANEL_SIZE,
      height: BUTTON_PANEL_SIZE,
      styles: {
        background: this.resolveColor('paletteBackground'),
        border: {
          color: this.resolveColor('paletteBorderColor'),
          width: 1,
          radius: 5,
        },
      },
    })
    schema.push({
      type: 'rect',
      x: BUTTON_PANEL_PADDING,
      y: y + BUTTON_PANEL_PADDING,
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      styles: {
        background: this.hoveredButton || this.openMenu
          ? this.resolveColor('paletteItemHoverBackground')
          : 'rgba(0,0,0,0)',
        border: {
          color: 'rgba(0,0,0,0)',
          width: 0,
          radius: 4,
        },
      },
    })
    schema.push({
      type: 'icon',
      icon: MODELER_ASSETS.icons.download,
      x: BUTTON_PANEL_PADDING + (BUTTON_SIZE - BUTTON_ICON_SIZE) / 2,
      y: y + BUTTON_PANEL_PADDING + (BUTTON_SIZE - BUTTON_ICON_SIZE) / 2,
      width: BUTTON_ICON_SIZE,
      height: BUTTON_ICON_SIZE,
      styles: { opacity: 1 },
    })
  }

  private appendMenu(schema: NovaSchema): void {
    const menuHeight = this.resolveMenuHeight()
    schema.push({
      type: 'rect',
      x: 0,
      y: 0,
      width: MENU_WIDTH,
      height: menuHeight,
      styles: {
        background: this.resolveColor('paletteBackground'),
        border: {
          color: this.resolveColor('paletteBorderColor'),
          width: 1,
          radius: 6,
        },
      },
    })
  }

  private syncChild(): void {
    if (!this.openMenu || !this.props.visible) {
      this.childRuntime.reconcile([])
      return
    }
    this.childRuntime.reconcile([this.createMenuLayout()])
  }

  private createMenuLayout(): NovaTemplateChildSchema {
    return {
      type: NovaUIKit.Flex,
      id: `${this.componentId}:menu-layout`,
      props: {
        x: MENU_PADDING,
        y: MENU_PADDING,
        width: MENU_WIDTH - MENU_PADDING * 2,
        height: MENU_ITEM_HEIGHT * MENU_ITEMS.length,
        col: true,
        gap: 0,
        alignItems: 'stretch',
        justifyContent: 'start',
        clip: true,
      },
      children: this.resolveMenuItems().map(item => ({
        type: NovaUIKit.Button,
        id: `${this.componentId}:menu-item:${item.id}`,
        layout: { width: 'fill', height: MENU_ITEM_HEIGHT },
        props: {
          text: item.label,
          icon: item.icon,
          iconPlacement: 'left',
          textAlign: 'left',
          variant: 'ghost',
          size: 'md',
          width: item.width,
          height: item.height,
          color: this.resolveColor('bpmnTaskTextColor'),
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 13,
          fontWeight: '600',
          background: 'rgba(0,0,0,0)',
          hoverBackground: this.resolveColor('paletteItemHoverBackground'),
          pressedBackground: this.resolveColor('paletteItemHoverBackground'),
          border: { color: 'rgba(0,0,0,0)', width: 0, radius: 4 },
          onPress: () => {
            this.runMenuAction(item)
            this.setOpen(false)
          },
        },
      })),
    }
  }

  private resolveMenuItems(): Array<DownloadMenuItemLayout> {
    return MENU_ITEMS.map((item, index) => ({
      ...item,
      x: MENU_PADDING,
      y: MENU_PADDING + index * MENU_ITEM_HEIGHT,
      width: MENU_WIDTH - MENU_PADDING * 2,
      height: MENU_ITEM_HEIGHT,
    }))
  }

  private resolveMenuItem(x: number, y: number): DownloadMenuItemLayout | null {
    if (!this.openMenu) return null
    return this.resolveMenuItems().find(item => (
      x >= item.x
      && x <= item.x + item.width
      && y >= item.y
      && y <= item.y + item.height
    )) ?? null
  }

  private containsButton(x: number, y: number): boolean {
    const buttonY = this.resolveButtonY() + BUTTON_PANEL_PADDING
    return x >= BUTTON_PANEL_PADDING
      && x <= BUTTON_PANEL_PADDING + BUTTON_SIZE
      && y >= buttonY
      && y <= buttonY + BUTTON_SIZE
  }

  private resolveButtonY(): number {
    return this.openMenu ? this.resolveMenuHeight() + MENU_GAP : 0
  }

  private resolveMenuHeight(): number {
    return MENU_PADDING * 2 + MENU_ITEM_HEIGHT * MENU_ITEMS.length
  }

  private runMenuAction(item: DownloadMenuItemLayout): void {
    this.resolvePluginContext()?.actions.run(item.actionId)
  }

  private resolvePluginContext(): ModelerPluginContext | undefined {
    return this.props.controller?.getPluginContext() ?? this.injectOptional(MODELER_CONTEXT)
  }

  private setCursor(cursor: 'button' | null): void {
    this.options({ cursorContext: { downloadControlsCursor: cursor ?? 'none' } })
  }

  private resolveColor(token: keyof typeof MODELER_THEME_FALLBACKS): string {
    const fallback = String(MODELER_THEME_FALLBACKS[token])
    return this.nova.theme.resolve(MODELER_THEME_TOKENS[token], fallback) ?? fallback
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const MODELER_DOWNLOAD_CONTROLS_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  DownloadControlsResolvedProps,
  DownloadControlsApi,
  Record<string, never>,
  DownloadControlsProps
>(DownloadControls as never) as DownloadControlsDescriptor
