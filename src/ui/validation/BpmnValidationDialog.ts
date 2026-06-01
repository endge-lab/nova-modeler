import {
  NovaComponentNode,
  type NovaApp,
  type NovaComponentCreateContext,
  type NovaComponentDescriptor,
  type NovaComponentNode as NovaComponentNodeType,
  type NovaComponentSchema,
  type NovaElementSchema,
  type NovaSurface,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import {
  NovaUIKit,
  findNovaUiRoot,
  type DialogDefinition,
  type DialogProps,
  type DialogSlotContext,
} from '@endge/nova-ui-kit'
import { MODELER_ASSETS } from '@/assets/modeler-assets'
import { Modeler } from '@/config/schema.config'
import {
  MODELER_BPMN_VALIDATION_DIALOG_TYPE,
  MODELER_BPMN_VALIDATION_DIALOG_HEIGHT,
  MODELER_BPMN_VALIDATION_DIALOG_MIN_HEIGHT,
  MODELER_BPMN_VALIDATION_DIALOG_MIN_WIDTH,
  MODELER_BPMN_VALIDATION_DIALOG_WIDTH,
  type BpmnValidationDialogPayload,
  type BpmnValidationDialogProps,
  type BpmnValidationDialogResolvedProps,
  type ModelerValidationIssue,
  type ModelerValidationResult,
} from '@/domain/types/index'

export interface BpmnValidationDialogApi {
  setProps: (patch: BpmnValidationDialogProps) => void
  getProps: () => Readonly<BpmnValidationDialogResolvedProps>
}

export type BpmnValidationDialogDescriptor = NovaComponentDescriptor<
  BpmnValidationDialogResolvedProps,
  BpmnValidationDialogApi,
  Record<string, never>,
  BpmnValidationDialogProps
>

const DEFAULT_RESULT: ModelerValidationResult = {
  status: 'valid',
  modelVersion: 0,
  issues: [],
}

const BODY_HORIZONTAL_PADDING = 36
const BODY_VERTICAL_CHROME = 108
const ISSUE_HEIGHT = 72
const ISSUE_GAP = 8

export class BpmnValidationDialog<E extends EventList = Record<string, any>>
  extends NovaComponentNode<BpmnValidationDialogResolvedProps, BpmnValidationDialogApi, Record<string, never>, BpmnValidationDialogProps, E> {
  private readonly sourceId: string
  private readonly api: BpmnValidationDialogApi

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    descriptor: BpmnValidationDialogDescriptor,
    props: BpmnValidationDialogResolvedProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, descriptor, props, options)
    this.sourceId = options.componentId ?? this.id
    this.api = {
      setProps: patch => this.setProps(patch),
      getProps: () => this.props,
    }
    this.visible = false
    this.options({ interactive: false })
  }

  override getApi(): BpmnValidationDialogApi {
    return this.api
  }

  override setProps(patch: BpmnValidationDialogProps): this {
    super.setProps(patch as Partial<BpmnValidationDialogResolvedProps>)
    return this
  }

  update(): void {}

  render(): void {}

  protected override onMount(): void {
    super.onMount()
    this.syncRootDefinition()
  }

  protected override onUnmount(): void {
    findNovaUiRoot(this)?.getApi?.().unregisterDialogDefinitions(this.sourceId)
    super.onUnmount()
  }

  protected override onPropsChanged(changedKeys: Array<keyof BpmnValidationDialogResolvedProps>): void {
    this.props = normalizeBpmnValidationDialogProps(this.props)
    super.onPropsChanged(changedKeys)
    this.visible = false
    this.options({ interactive: false })
    this.syncRootDefinition()
  }

  private syncRootDefinition(): void {
    const definition: DialogDefinition = {
      type: this.props.type,
      props: this.createDialogProps(),
      slot: slot => this.createDialogBody(slot),
    }
    findNovaUiRoot(this)?.getApi?.().registerDialogDefinitions(this.sourceId, [definition])
  }

  private createDialogProps(): DialogProps {
    return {
      title: this.props.title,
      description: this.props.description,
      width: this.props.width,
      height: this.props.height,
      minWidth: this.props.minWidth,
      minHeight: this.props.minHeight,
      modal: this.props.modal,
      backdrop: this.props.backdrop,
      closeButton: this.props.closeButton,
      draggable: this.props.draggable,
      resizable: this.props.resizable,
      placement: 'center',
      background: 'var(--nova-modeler-validation-dialog-background, #ffffff)',
      color: 'var(--nova-modeler-validation-dialog-color, #172033)',
      border: {
        color: 'var(--nova-modeler-validation-dialog-border-color, #cbd5e1)',
        width: 1,
        radius: 10,
      },
      padding: {
        horizontal: 18,
        vertical: 16,
      },
    } as DialogProps
  }

  private createDialogBody(slot: DialogSlotContext): Array<NovaElementSchema<any>> {
    const dialogProps = slot.props as DialogProps & { width: number; height: number }
    const bodyWidth = Math.max(0, dialogProps.width - BODY_HORIZONTAL_PADDING)
    const bodyHeight = Math.max(0, dialogProps.height - BODY_VERTICAL_CHROME)
    const result = resolvePayloadResult(slot)
    const errors = result.issues.filter(issue => issue.severity === 'error')

    return [{
      type: NovaUIKit.Flex,
      id: `${slot.id}:bpmn-validation-layout`,
      props: {
        col: true,
        gap: 12,
        width: bodyWidth,
        height: bodyHeight,
        clip: true,
      },
      children: [
        this.createSummary(slot, bodyWidth, errors.length),
        this.createIssueList(slot, bodyWidth, Math.max(0, bodyHeight - 48), errors),
      ],
    }]
  }

  private createSummary(slot: DialogSlotContext, width: number, errorCount: number): NovaElementSchema<any> {
    const valid = errorCount === 0
    return {
      type: NovaUIKit.Flex,
      id: `${slot.id}:bpmn-validation-summary`,
      props: {
        row: true,
        gap: 8,
        alignItems: 'center',
        width,
        height: 36,
        padding: { top: 0, right: 12, bottom: 0, left: 12 },
        background: valid ? '#f0fdf4' : '#fef2f2',
        border: {
          color: valid ? '#bbf7d0' : '#fecaca',
          width: 1,
          radius: 8,
        },
      },
      children: [
        {
          type: NovaUIKit.Tag,
          id: `${slot.id}:bpmn-validation-summary-tag`,
          props: {
            text: valid ? 'Valid' : 'Invalid',
            icon: valid ? MODELER_ASSETS.icons.validationValid : MODELER_ASSETS.icons.validationInvalid,
            tone: valid ? 'success' : 'danger',
            size: 'sm',
            position: 'static',
            width: 82,
            height: 24,
          },
        },
        {
          type: NovaUIKit.TextBlock,
          id: `${slot.id}:bpmn-validation-summary-text`,
          props: {
            text: valid ? 'No BPMN errors found' : `${errorCount} BPMN error${errorCount === 1 ? '' : 's'} found`,
            position: 'static',
            width: Math.max(0, width - 114),
            height: 22,
            fontSize: 13,
            fontWeight: '500',
            color: valid ? '#15803d' : '#b91c1c',
            verticalAlign: 'middle',
            overflow: 'ellipsis',
          },
        },
      ],
    }
  }

  private createIssueList(
    slot: DialogSlotContext,
    width: number,
    height: number,
    errors: Array<ModelerValidationIssue>,
  ): NovaElementSchema<any> {
    if (errors.length === 0) {
      return {
        type: NovaUIKit.TextBlock,
        id: `${slot.id}:bpmn-validation-empty`,
        props: {
          text: 'Диаграмма сейчас проходит структурную BPMN-проверку.',
          width,
          height: 28,
          fontSize: 12,
          color: '#64748b',
        },
      }
    }

    const contentHeight = errors.length * ISSUE_HEIGHT + Math.max(0, errors.length - 1) * ISSUE_GAP
    return {
      type: NovaUIKit.ScrollArea,
      id: `${slot.id}:bpmn-validation-scroll`,
      props: {
        width,
        height,
        contentWidth: width,
        contentHeight,
        axis: 'y',
        scrollbarVisibility: 'auto',
      },
      children: [{
        type: NovaUIKit.Flex,
        id: `${slot.id}:bpmn-validation-errors`,
        props: {
          col: true,
          gap: ISSUE_GAP,
          width: Math.max(0, width - 12),
          height: contentHeight,
          padding: 0,
        },
        children: errors.map((issue, index) => this.createIssueItem(slot, issue, index, Math.max(0, width - 12))),
      }],
    }
  }

  private createIssueItem(
    slot: DialogSlotContext,
    issue: ModelerValidationIssue,
    index: number,
    width: number,
  ): NovaElementSchema<any> {
    const detail = issue.elementIds.length > 0
      ? `${issue.ruleId} · ${issue.elementIds.join(', ')}`
      : issue.ruleId
    return {
      type: NovaUIKit.Panel,
      id: `${slot.id}:bpmn-validation-issue:${index}`,
      props: {
        title: issue.message,
        subtitle: detail,
        position: 'static',
        width,
        height: ISSUE_HEIGHT,
        density: 'compact',
        background: '#fff7f7',
        color: '#991b1b',
        border: {
          color: '#fecaca',
          width: 1,
          radius: 8,
        },
        padding: { top: 10, right: 12, bottom: 10, left: 12 },
      },
    }
  }
}

export function normalizeBpmnValidationDialogProps(
  props: BpmnValidationDialogProps = {},
): BpmnValidationDialogResolvedProps {
  return {
    type: props.type ?? MODELER_BPMN_VALIDATION_DIALOG_TYPE,
    title: props.title ?? 'BPMN validation',
    description: props.description ?? '',
    width: props.width ?? MODELER_BPMN_VALIDATION_DIALOG_WIDTH,
    height: props.height ?? MODELER_BPMN_VALIDATION_DIALOG_HEIGHT,
    minWidth: props.minWidth ?? MODELER_BPMN_VALIDATION_DIALOG_MIN_WIDTH,
    minHeight: props.minHeight ?? MODELER_BPMN_VALIDATION_DIALOG_MIN_HEIGHT,
    modal: props.modal ?? true,
    backdrop: props.backdrop ?? true,
    closeButton: props.closeButton ?? true,
    draggable: props.draggable ?? true,
    resizable: props.resizable ?? false,
  }
}

export function createBpmnValidationDialogDescriptor(
  createNode?: <E extends EventList>(
    context: NovaComponentCreateContext<E>,
    schema: NovaComponentSchema<BpmnValidationDialogProps>,
  ) => NovaComponentNodeType<
    BpmnValidationDialogResolvedProps,
    BpmnValidationDialogApi,
    Record<string, never>,
    BpmnValidationDialogProps,
    E
  >,
): BpmnValidationDialogDescriptor {
  const descriptor: BpmnValidationDialogDescriptor = {
    type: Modeler.BpmnValidationDialog,
    name: 'BpmnValidationDialog',
    title: 'BpmnValidationDialog',
    version: '0.1.0',
    kind: 'node-component',
    dirtyPolicy: {
      update: ['type', 'title', 'description', 'width', 'height'],
      render: [],
    },
    fields: {
      type: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      width: { type: 'number' },
      height: { type: 'number' },
      minWidth: { type: 'number' },
      minHeight: { type: 'number' },
      modal: { type: 'boolean' },
      backdrop: { type: 'boolean' },
      closeButton: { type: 'boolean' },
      draggable: { type: 'boolean' },
      resizable: { type: 'boolean' },
    },
    normalize: schema => normalizeBpmnValidationDialogProps(schema.props),
    measureBounds: () => null,
  }

  descriptor.createNode = createNode ?? ((context, schema) => new BpmnValidationDialog(
    context.app,
    context.surface,
    descriptor,
    normalizeBpmnValidationDialogProps(schema.props),
    { componentId: schema.id },
  ))

  return descriptor
}

export const MODELER_BPMN_VALIDATION_DIALOG_DESCRIPTOR = createBpmnValidationDialogDescriptor()

function resolvePayloadResult(slot: DialogSlotContext): ModelerValidationResult {
  const payload = slot as DialogSlotContext & BpmnValidationDialogPayload
  return payload.result ?? DEFAULT_RESULT
}
