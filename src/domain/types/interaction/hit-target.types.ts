import type { ModelerResizeHandle } from '@/domain/types/interaction/resize.types'

export type ModelerHitTarget =
  | { type: 'canvas' | 'empty' }
  | { type: 'element'; id: string }
  | { type: 'element-part'; id: string; partType: string; partId: string }
  | { type: 'port'; elementId: string; portId: string }
  | { type: 'resize-handle'; elementId: string; handle: ModelerResizeHandle }
  | { type: 'bpmn-lane-resize-handle'; elementId: string; laneId: string; orientation: 'horizontal' | 'vertical' }
  | { type: 'rotate-handle'; elementId: string }
  | { type: 'edge-waypoint-handle'; elementId: string; waypointIndex: number }
  | { type: 'edge-segment-handle'; elementId: string; segmentIndex: number }
