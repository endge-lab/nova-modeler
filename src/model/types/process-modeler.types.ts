export type ProcessElementKind =
  | 'startEvent'
  | 'endEvent'
  | 'userTask'
  | 'serviceTask'
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'sequenceFlow'
  | 'pool'
  | 'lane'

export type ProcessNodeKind = Exclude<ProcessElementKind, 'sequenceFlow' | 'pool' | 'lane'>
export type ProcessGatewayKind = Extract<ProcessNodeKind, 'exclusiveGateway' | 'parallelGateway'>
export type ProcessTaskKind = Extract<ProcessNodeKind, 'userTask' | 'serviceTask'>
export type ProcessEventKind = Extract<ProcessNodeKind, 'startEvent' | 'endEvent'>
export type ProcessElementId = string
export type ProcessSelectionMode = 'replace' | 'append' | 'toggle'
export type ProcessEdgeKind = 'sequenceFlow'
export type ProcessPortDirection = 'input' | 'output' | 'bidirectional'
export type ProcessPortSide = 'top' | 'right' | 'bottom' | 'left'
export type ProcessValidationSeverity = 'error' | 'warning' | 'info'
export type ProcessValidationCode =
  | 'missing-start'
  | 'missing-end'
  | 'duplicate-id'
  | 'orphan-node'
  | 'dangling-edge'
  | 'invalid-edge-target'
  | 'invalid-port'
  | 'invalid-gateway'
  | 'unsupported'

export interface ProcessPoint {
  x: number
  y: number
}

export interface ProcessRect extends ProcessPoint {
  width: number
  height: number
}

export interface ProcessMetadata {
  name?: string
  description?: string
  formId?: string
  actionId?: string
  assignee?: string
  condition?: string
  tags?: Array<string>
  custom?: Record<string, unknown>
}

export interface ProcessNode {
  id: ProcessElementId
  kind: ProcessNodeKind
  x: number
  y: number
  width: number
  height: number
  laneId?: ProcessElementId
  ports?: Array<ProcessPortDefinition>
  metadata: ProcessMetadata
}

export interface ProcessEdge {
  id: ProcessElementId
  kind: ProcessEdgeKind
  sourceId: ProcessElementId
  targetId: ProcessElementId
  sourcePortId?: string
  targetPortId?: string
  waypoints?: Array<ProcessPoint>
  metadata: ProcessMetadata
}

export interface ProcessPortDefinition {
  id: string
  direction: ProcessPortDirection
  side: ProcessPortSide
  align: number
  offset: number
  enabled: boolean
  capacity?: number | 'unlimited'
  accepts?: Array<ProcessEdgeKind>
  emits?: Array<ProcessEdgeKind>
  metadata: ProcessMetadata
}

export type ProcessPortInput =
  | false
  | Array<Partial<ProcessPortDefinition> & Pick<ProcessPortDefinition, 'id' | 'direction' | 'side'>>

export interface ProcessResolvedPort extends ProcessPortDefinition {
  nodeId: ProcessElementId
  x: number
  y: number
  worldX: number
  worldY: number
  bounds: ProcessRect
  connectionCount: number
}

export interface ProcessLane {
  id: ProcessElementId
  kind: 'lane'
  x: number
  y: number
  width: number
  height: number
  metadata: ProcessMetadata
}

export interface ProcessPool {
  id: ProcessElementId
  kind: 'pool'
  x: number
  y: number
  width: number
  height: number
  metadata: ProcessMetadata
  lanes: Array<ProcessLane>
}

export interface ProcessViewport {
  x: number
  y: number
  scale: number
}

export interface ProcessModel {
  id: string
  version: string
  metadata: ProcessMetadata
  nodes: Array<ProcessNode>
  edges: Array<ProcessEdge>
  pools: Array<ProcessPool>
  selection: Array<ProcessElementId>
  viewport: ProcessViewport
  issues: Array<ProcessValidationIssue>
}

export interface ProcessModelInput {
  id?: string
  version?: string
  metadata?: ProcessMetadata
  nodes?: Array<Omit<Partial<ProcessNode>, 'ports'> & Pick<ProcessNode, 'id' | 'kind'> & { ports?: ProcessPortInput }>
  edges?: Array<Partial<ProcessEdge> & Pick<ProcessEdge, 'id' | 'sourceId' | 'targetId'>>
  pools?: Array<Partial<ProcessPool> & Pick<ProcessPool, 'id'>>
  selection?: Array<ProcessElementId>
  viewport?: Partial<ProcessViewport>
  issues?: Array<ProcessValidationIssue>
}

export interface ProcessValidationIssue {
  code: ProcessValidationCode
  severity: ProcessValidationSeverity
  message: string
  elementId?: ProcessElementId
  details?: Record<string, unknown>
}

export interface ProcessCommandBase {
  type: string
}

export interface ProcessAddNodeCommand extends ProcessCommandBase {
  type: 'addNode'
  node: Partial<ProcessNode> & Pick<ProcessNode, 'id' | 'kind' | 'x' | 'y'>
  select?: boolean
}

export interface ProcessMoveNodeCommand extends ProcessCommandBase {
  type: 'moveNode'
  id: ProcessElementId
  dx: number
  dy: number
}

export interface ProcessConnectCommand extends ProcessCommandBase {
  type: 'connect'
  id?: ProcessElementId
  sourceId: ProcessElementId
  targetId: ProcessElementId
  sourcePortId?: string
  targetPortId?: string
  metadata?: ProcessMetadata
  select?: boolean
}

export interface ProcessDeleteCommand extends ProcessCommandBase {
  type: 'delete'
  ids: Array<ProcessElementId>
}

export interface ProcessSelectCommand extends ProcessCommandBase {
  type: 'select'
  ids: Array<ProcessElementId>
  mode?: ProcessSelectionMode
}

export interface ProcessUpdateMetadataCommand extends ProcessCommandBase {
  type: 'updateMetadata'
  id: ProcessElementId
  metadata: ProcessMetadata
}

export interface ProcessSetViewportCommand extends ProcessCommandBase {
  type: 'setViewport'
  viewport: Partial<ProcessViewport>
}

export interface ProcessSetModelCommand extends ProcessCommandBase {
  type: 'setModel'
  model: ProcessModelInput | ProcessModel
}

export type ProcessCommand =
  | ProcessAddNodeCommand
  | ProcessMoveNodeCommand
  | ProcessConnectCommand
  | ProcessDeleteCommand
  | ProcessSelectCommand
  | ProcessUpdateMetadataCommand
  | ProcessSetViewportCommand
  | ProcessSetModelCommand

export interface LowCodeProcessTask {
  id: ProcessElementId
  kind: ProcessTaskKind
  name: string
  formId?: string
  actionId?: string
  assignee?: string
  metadata: ProcessMetadata
}

export interface LowCodeProcessTransition {
  id: ProcessElementId
  from: ProcessElementId
  to: ProcessElementId
  sourcePortId?: string
  targetPortId?: string
  condition?: string
  metadata: ProcessMetadata
}

export interface LowCodeProcessGateway {
  id: ProcessElementId
  kind: ProcessGatewayKind
  name: string
  outgoing: Array<ProcessElementId>
  incoming: Array<ProcessElementId>
}

export interface LowCodeProcessManifest {
  id: string
  version: string
  name: string
  tasks: Array<LowCodeProcessTask>
  gateways: Array<LowCodeProcessGateway>
  transitions: Array<LowCodeProcessTransition>
  forms: Array<string>
  actions: Array<string>
  issues: Array<ProcessValidationIssue>
}

export interface ProcessModelerLayoutOptions {
  width: number
  height: number
  paletteWidth?: number
  inspectorWidth?: number
  panelPadding?: number
}

export interface ProcessModelerNodeLayout extends ProcessRect {
  id: ProcessElementId
  kind: ProcessNodeKind
  selected: boolean
  invalid: boolean
  label: string
}

export interface ProcessModelerEdgeLayout {
  id: ProcessElementId
  sourceId: ProcessElementId
  targetId: ProcessElementId
  sourcePortId?: string
  targetPortId?: string
  selected: boolean
  invalid: boolean
  points: Array<ProcessPoint>
  label?: string
}

export interface ProcessModelerPanelLayout extends ProcessRect {
  id: string
}

export interface ProcessModelerLayout {
  nodes: Array<ProcessModelerNodeLayout>
  edges: Array<ProcessModelerEdgeLayout>
  ports: Array<ProcessResolvedPort>
  palette: ProcessModelerPanelLayout
  inspector: ProcessModelerPanelLayout
  canvas: ProcessModelerPanelLayout
  validation: ProcessModelerPanelLayout
  diagnostics: {
    nodeCount: number
    edgeCount: number
    indexedItems: number
  }
}

export type ProcessModelerHitTargetType = 'node' | 'edge' | 'palette' | 'inspector' | 'canvas' | 'validation' | 'empty'
  | 'port'

export interface ProcessModelerHitTarget {
  type: ProcessModelerHitTargetType
  id?: ProcessElementId | string
  kind?: ProcessNodeKind
  nodeId?: ProcessElementId
  portId?: string
  direction?: ProcessPortDirection
}

export interface ProcessModelerRootProps {
  model?: ProcessModelInput | ProcessModel
  width?: number
  height?: number
  paletteWidth?: number
  inspectorWidth?: number
  readonly?: boolean
  onModelChange?: (model: ProcessModel) => void
  onSelectionChange?: (selection: Array<ProcessElementId>) => void
  onValidationChange?: (issues: Array<ProcessValidationIssue>) => void
}

export interface ProcessModelerRootResolvedProps extends Required<Omit<
  ProcessModelerRootProps,
  'model' | 'onModelChange' | 'onSelectionChange' | 'onValidationChange'
>> {
  model: ProcessModel
  onModelChange?: (model: ProcessModel) => void
  onSelectionChange?: (selection: Array<ProcessElementId>) => void
  onValidationChange?: (issues: Array<ProcessValidationIssue>) => void
}

export interface ProcessModelerRootApi {
  setModel: (model: ProcessModelInput | ProcessModel) => void
  getModel: () => ProcessModel
  applyCommand: (command: ProcessCommand) => ProcessModel
  undo: () => ProcessModel
  redo: () => ProcessModel
  validate: () => Array<ProcessValidationIssue>
  fitView: () => ProcessViewport
  focusElement: (id: ProcessElementId) => boolean
  exportBpmnXml: () => string
  compileLowCodeManifest: () => LowCodeProcessManifest
}
