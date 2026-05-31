import type { ModelerResizeHandle } from '@/domain/types/interaction/resize.types'

export type ModelerHitTarget =
  | { type: 'canvas' | 'empty' }
  | { type: 'element'; id: string }
  | { type: 'port'; elementId: string; portId: string }
  | { type: 'resize-handle'; elementId: string; handle: ModelerResizeHandle }
  | { type: 'rotate-handle'; elementId: string }
  | { type: 'edge-waypoint-handle'; elementId: string; waypointIndex: number }
  | { type: 'edge-segment-handle'; elementId: string; segmentIndex: number }
