import type { ModelerResizeHandle } from '@/domain/types/interaction/resize.types'

export interface ModelerElementResizeCapability {
  handles: Array<ModelerResizeHandle>
  minWidth?: number
  minHeight?: number
  preserveAspectRatio?: boolean
}

export interface ModelerElementPortCapability {
  visible: 'always' | 'hover' | 'selected'
  strategy: 'definition' | 'data' | 'both'
}

export interface ModelerElementConnectableCapability {
  incoming?: boolean
  outgoing?: boolean
  allowedConnectionTypes?: Array<string>
}

export interface ModelerElementCursorCapability {
  body?: string
  hover?: string
  drag?: string
}

export interface ModelerElementRotateCapability {
  handleOffset?: number
  snapDegrees?: number
}

export interface ModelerElementCapabilities {
  selectable?: boolean
  draggable?: boolean
  resizable?: false | ModelerElementResizeCapability
  rotatable?: false | ModelerElementRotateCapability
  ports?: false | ModelerElementPortCapability
  connectable?: false | ModelerElementConnectableCapability
  cursor?: ModelerElementCursorCapability
}
