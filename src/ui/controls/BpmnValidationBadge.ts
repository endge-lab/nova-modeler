import {
  NovaComponent,
  NovaComponentNode,
  createNovaDecoratedComponentDescriptor,
  type NovaApp,
  type NovaComponentDescriptor,
  type NovaSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import {
  NOVA_UI_LAYOUT_TARGET,
  findNovaUiRoot,
  type NovaUiLayoutConstraints,
  type NovaUiLayoutMeasure,
  type NovaUiLayoutRect,
  type RootApi,
} from '@endge/nova-ui-kit'
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_BPMN_VALIDATION_DIALOG_TYPE,
  MODELER_BPMN_VALIDATION_DIALOG_HEIGHT,
  MODELER_BPMN_VALIDATION_DIALOG_MIN_HEIGHT,
  MODELER_BPMN_VALIDATION_DIALOG_MIN_WIDTH,
  MODELER_BPMN_VALIDATION_DIALOG_WIDTH,
  type ModelerController,
  type ModelerValidationResult,
} from '@/domain/types/index'
import { BPMN_VALIDATION_RESULT_KEY } from '@/plugins/bpmn-validation/BpmnValidationPlugin'

export interface BpmnValidationBadgeProps {
  controller?: ModelerController
  result?: ModelerValidationResult
  rootId?: string
  dialogType?: string
  dialogId?: string
  visible?: boolean
  zIndex?: number
}

export interface BpmnValidationBadgeResolvedProps {
  controller?: ModelerController
  result?: ModelerValidationResult
  rootId?: string
  dialogType: string
  dialogId: string
  visible: boolean
  zIndex?: number
}

export type BpmnValidationBadgeDescriptor = NovaComponentDescriptor<
  BpmnValidationBadgeResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnValidationBadgeProps
>

const BADGE_WIDTH = 142
const BADGE_HEIGHT = 36
const ICON_SIZE = 18
const LABEL_HEIGHT = 20
const DEFAULT_VALIDATION_RESULT: ModelerValidationResult = {
  status: 'valid',
  modelVersion: 0,
  issues: [],
}

@NovaComponent({
  type: Modeler.BpmnValidationBadge,
  name: 'BpmnValidationBadge',
  version: '0.1.0',
  dirtyPolicy: {
    matrix: ['x', 'y', 'zIndex'],
    update: ['visible', 'zIndex'],
    render: ['controller', 'result', 'rootId', 'dialogType', 'dialogId', 'visible'],
  },
})
export class BpmnValidationBadge<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnValidationBadgeResolvedProps, Record<string, never>, Record<string, never>, BpmnValidationBadgeProps, E> {
  readonly [NOVA_UI_LAYOUT_TARGET] = true as const

  private externalLayout = false

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnValidationBadgeDescriptor,
    props: BpmnValidationBadgeResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.options({
      width: BADGE_WIDTH,
      height: BADGE_HEIGHT,
      interactive: props.visible,
      zIndex: props.zIndex,
    })
    this.setupEvents()
  }

  static normalizeProps(props: BpmnValidationBadgeProps = {}): BpmnValidationBadgeResolvedProps {
    return {
      controller: props.controller,
      result: props.result,
      rootId: props.rootId,
      dialogType: props.dialogType ?? MODELER_BPMN_VALIDATION_DIALOG_TYPE,
      dialogId: props.dialogId ?? MODELER_BPMN_VALIDATION_DIALOG_TYPE,
      visible: props.visible ?? true,
      zIndex: props.zIndex,
    }
  }

  override setProps(patch: BpmnValidationBadgeProps): this {
    super.setProps(patch as Partial<BpmnValidationBadgeResolvedProps>)
    this.props = BpmnValidationBadge.normalizeProps(this.props)
    if (!this.externalLayout) {
      this.options({
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
        interactive: this.props.visible,
        zIndex: this.props.zIndex,
      })
    }
    return this
  }

  applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    this.externalLayout = true
    const changed = this.x !== rect.x || this.y !== rect.y || this.width !== rect.width || this.height !== rect.height
    this.options({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      interactive: this.props.visible,
      zIndex: this.props.zIndex,
    })
    if (changed) this.dirty({ matrix: true, render: true })
    return changed
  }

  measureLayout(_constraints: NovaUiLayoutConstraints): NovaUiLayoutMeasure {
    return { width: BADGE_WIDTH, height: BADGE_HEIGHT }
  }

  render(): void {
    super.render()
    if (!this.props.visible) {
      this.renderer.schema([])
      return
    }
    this.syncCursor()
    this.renderer.schema(this.createSchema())
  }

  private createSchema(): NovaSchema {
    const result = this.resolveResult()
    const valid = result.status === 'valid'
    const colors = valid
      ? {
          background: '#f0fdf4',
          border: '#bbf7d0',
          text: '#16a34a',
          icon: MODELER_ASSETS.icons.validationValid,
          label: 'Valid BPMN',
        }
      : {
          background: '#fef2f2',
          border: '#fecaca',
          text: '#dc2626',
          icon: MODELER_ASSETS.icons.validationInvalid,
          label: 'Invalid BPMN',
        }
    return [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: this.width,
        height: this.height,
        styles: {
          background: colors.background,
          border: {
            color: colors.border,
            width: 1,
            radius: 8,
          },
        },
      },
      {
        type: 'icon',
        icon: colors.icon,
        x: 14,
        y: (this.height - ICON_SIZE) / 2,
        width: ICON_SIZE,
        height: ICON_SIZE,
        styles: { opacity: 1 },
      },
      {
        type: 'text',
        text: colors.label,
        x: 42,
        y: (this.height - LABEL_HEIGHT) / 2 + 1,
        width: Math.max(1, this.width - 54),
        height: LABEL_HEIGHT,
        styles: {
          color: colors.text,
          font: {
            family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            size: 14,
            weight: '500',
          },
          lineHeight: LABEL_HEIGHT,
          align: { horizontal: 'left', vertical: 'middle' },
          ellipsis: true,
        },
      },
    ]
  }

  private resolveResult(): ModelerValidationResult {
    return this.props.result
      ?? this.props.controller?.getPluginContext().store.inject(BPMN_VALIDATION_RESULT_KEY)
      ?? DEFAULT_VALIDATION_RESULT
  }

  private setupEvents(): void {
    this.on('mouseenter', () => this.syncCursor())
    this.on('mousemove', () => this.syncCursor())
    this.on('mouseleave', () => this.setCursor(null))
    this.on('mousedown', event => {
      const result = this.resolveResult()
      if (result.status !== 'invalid') return false
      this.resolveRootApi()?.openDialog({
        id: this.props.dialogId,
        type: this.props.dialogType,
        width: MODELER_BPMN_VALIDATION_DIALOG_WIDTH,
        height: MODELER_BPMN_VALIDATION_DIALOG_HEIGHT,
        minWidth: MODELER_BPMN_VALIDATION_DIALOG_MIN_WIDTH,
        minHeight: MODELER_BPMN_VALIDATION_DIALOG_MIN_HEIGHT,
        result,
      })
      event.preventDefault()
      return false
    })
  }

  private syncCursor(): void {
    this.setCursor(this.resolveResult().status === 'invalid' ? 'button' : null)
  }

  private setCursor(cursor: 'button' | null): void {
    this.options({ cursorContext: { bpmnValidationBadgeCursor: cursor ?? 'none' } })
  }

  private resolveRootApi(): RootApi | null {
    return findNovaUiRoot(this)?.getApi?.()
      ?? (this.props.rootId ? this.nova.components.api<RootApi>(this.props.rootId) : undefined)
      ?? null
  }
}

export const MODELER_BPMN_VALIDATION_BADGE_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnValidationBadgeResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnValidationBadgeProps
>(BpmnValidationBadge as never) as BpmnValidationBadgeDescriptor
