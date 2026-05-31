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
  type NovaUiLayoutConstraints,
  type NovaUiLayoutMeasure,
  type NovaUiLayoutRect,
} from '@endge/nova-ui-kit'
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { Modeler } from '@/config/schema.config'
import type {
  ModelerController,
  ModelerValidationResult,
} from '@/domain/types/index'
import { BPMN_VALIDATION_RESULT_KEY } from '@/plugins/bpmn-validation/BpmnValidationPlugin'

export interface BpmnValidationBadgeProps {
  controller?: ModelerController
  result?: ModelerValidationResult
  visible?: boolean
  zIndex?: number
}

export interface BpmnValidationBadgeResolvedProps {
  controller?: ModelerController
  result?: ModelerValidationResult
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
const ICON_SIZE = 20
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
    render: ['controller', 'result', 'visible'],
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
      interactive: false,
      zIndex: props.zIndex,
    })
  }

  static normalizeProps(props: BpmnValidationBadgeProps = {}): BpmnValidationBadgeResolvedProps {
    return {
      controller: props.controller,
      result: props.result,
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
        interactive: false,
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
      interactive: false,
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
        y: 0,
        width: Math.max(1, this.width - 54),
        height: this.height,
        styles: {
          color: colors.text,
          font: {
            family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            size: 14,
            weight: '700',
          },
          lineHeight: this.height,
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
}

export const MODELER_BPMN_VALIDATION_BADGE_DESCRIPTOR = createNovaDecoratedComponentDescriptor<
  BpmnValidationBadgeResolvedProps,
  Record<string, never>,
  Record<string, never>,
  BpmnValidationBadgeProps
>(BpmnValidationBadge as never) as BpmnValidationBadgeDescriptor
