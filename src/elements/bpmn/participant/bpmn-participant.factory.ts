import type {
  ModelerElement,
  ModelerElementStyle,
  ModelerRect,
} from '@/domain/types/index'
import type {
  BpmnParticipantElement,
  BpmnParticipantElementInput,
  BpmnParticipantLane,
  BpmnParticipantLayout,
  BpmnParticipantOrientation,
} from '@/elements/bpmn/participant/bpmn-participant.types'

export const BPMN_PARTICIPANT_TYPE = 'bpmn.participant'
export const BPMN_PARTICIPANT_DEFAULT_WIDTH = 520
export const BPMN_PARTICIPANT_DEFAULT_HEIGHT = 260
export const BPMN_PARTICIPANT_HEADER_SIZE = 32
export const BPMN_PARTICIPANT_LANE_HEADER_SIZE = 96
export const BPMN_PARTICIPANT_MIN_CONTENT_SIZE = 120
export const BPMN_PARTICIPANT_MIN_LANE_SIZE = 64
export const BPMN_PARTICIPANT_MIN_WIDTH = BPMN_PARTICIPANT_HEADER_SIZE + BPMN_PARTICIPANT_LANE_HEADER_SIZE + BPMN_PARTICIPANT_MIN_CONTENT_SIZE
export const BPMN_PARTICIPANT_MIN_HEIGHT = 120

export function createBpmnParticipantElement(input: BpmnParticipantElementInput): BpmnParticipantElement {
  const data = input.data ?? {}
  const orientation = normalizeBpmnParticipantOrientation(input.orientation ?? data.orientation)
  const sourceLanes = input.lanes ?? (Array.isArray(data.lanes) ? data.lanes : undefined)
  const baseWidth = finitePositive(input.width, BPMN_PARTICIPANT_DEFAULT_WIDTH)
  const baseHeight = finitePositive(input.height, BPMN_PARTICIPANT_DEFAULT_HEIGHT)
  const lanes = normalizeBpmnParticipantLanes(sourceLanes, orientation, orientation === 'horizontal' ? baseHeight : baseWidth)
  const singleLaneVisible = normalizeSingleLaneVisible(input.singleLaneVisible ?? data.singleLaneVisible, lanes.length)
  const size = clampBpmnParticipantSize(baseWidth, baseHeight, orientation, lanes.length, singleLaneVisible)
  return {
    id: input.id,
    type: BPMN_PARTICIPANT_TYPE,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: size.width,
    height: size.height,
    rotation: input.rotation,
    zIndex: input.zIndex,
    data: {
      ...data,
      name: normalizeName(input.name ?? data.name, 'Participant'),
      orientation,
      singleLaneVisible,
      lanes: normalizeBpmnParticipantLanes(lanes, orientation, orientation === 'horizontal' ? size.height : size.width),
    },
    style: input.style ? { ...input.style } : {},
  }
}

export function normalizeBpmnParticipantOrientation(value: unknown): BpmnParticipantOrientation {
  return value === 'vertical' ? 'vertical' : 'horizontal'
}

export function createBpmnParticipantLayout(element: BpmnParticipantElement): BpmnParticipantLayout {
  const orientation = normalizeBpmnParticipantOrientation(element.data?.orientation)
  const lanes = normalizeBpmnParticipantLanes(element.data?.lanes, orientation, orientation === 'horizontal' ? element.height : element.width)
  const laneHeadersVisible = areBpmnParticipantLaneHeadersVisible(element)
  const bounds = { x: element.x, y: element.y, width: element.width, height: element.height }
  if (orientation === 'vertical') {
    const participantHeaderRect = { x: element.x, y: element.y, width: element.width, height: BPMN_PARTICIPANT_HEADER_SIZE }
    const laneHeaderAreaRect = {
      x: element.x,
      y: element.y + BPMN_PARTICIPANT_HEADER_SIZE,
      width: element.width,
      height: laneHeadersVisible ? BPMN_PARTICIPANT_LANE_HEADER_SIZE : 0,
    }
    const contentRect = {
      x: element.x,
      y: laneHeaderAreaRect.y + laneHeaderAreaRect.height,
      width: element.width,
      height: Math.max(0, element.height - BPMN_PARTICIPANT_HEADER_SIZE - laneHeaderAreaRect.height),
    }
    let x = element.x
    return {
      bounds,
      participantHeaderRect,
      laneHeaderAreaRect,
      contentRect,
      lanes: lanes.map(lane => {
        const width = lane.size
        const rect = { x, y: laneHeaderAreaRect.y, width, height: element.height - BPMN_PARTICIPANT_HEADER_SIZE }
        const headerRect = { x, y: laneHeaderAreaRect.y, width, height: laneHeaderAreaRect.height }
        const laneContentRect = { x, y: contentRect.y, width, height: contentRect.height }
        x += width
        return { ...lane, rect, headerRect, contentRect: laneContentRect }
      }),
    }
  }

  const participantHeaderRect = { x: element.x, y: element.y, width: BPMN_PARTICIPANT_HEADER_SIZE, height: element.height }
  const laneHeaderAreaRect = {
    x: element.x + BPMN_PARTICIPANT_HEADER_SIZE,
    y: element.y,
    width: laneHeadersVisible ? BPMN_PARTICIPANT_LANE_HEADER_SIZE : 0,
    height: element.height,
  }
  const contentRect = {
    x: laneHeaderAreaRect.x + laneHeaderAreaRect.width,
    y: element.y,
    width: Math.max(0, element.width - BPMN_PARTICIPANT_HEADER_SIZE - laneHeaderAreaRect.width),
    height: element.height,
  }
  let y = element.y
  return {
    bounds,
    participantHeaderRect,
    laneHeaderAreaRect,
    contentRect,
    lanes: lanes.map(lane => {
      const height = lane.size
      const rect = { x: laneHeaderAreaRect.x, y, width: element.width - BPMN_PARTICIPANT_HEADER_SIZE, height }
      const headerRect = { x: laneHeaderAreaRect.x, y, width: laneHeaderAreaRect.width, height }
      const laneContentRect = { x: contentRect.x, y, width: contentRect.width, height }
      y += height
      return { ...lane, rect, headerRect, contentRect: laneContentRect }
    }),
  }
}

export function resolveBpmnParticipantPartAt(
  element: BpmnParticipantElement,
  point: { x: number; y: number },
): { partType: 'bpmn.swimlane.participant' | 'bpmn.swimlane.lane'; partId: string } | null {
  const layout = createBpmnParticipantLayout(element)
  if (containsRect(layout.participantHeaderRect, point)) {
    return { partType: 'bpmn.swimlane.participant', partId: 'participant' }
  }
  if (!areBpmnParticipantLaneHeadersVisible(element)) return null
  const lane = layout.lanes.find(item => containsRect(item.headerRect, point))
  return lane ? { partType: 'bpmn.swimlane.lane', partId: lane.id } : null
}

export function canToggleBpmnParticipantSingleLane(element: BpmnParticipantElement): boolean {
  const orientation = normalizeBpmnParticipantOrientation(element.data?.orientation)
  return normalizeBpmnParticipantLanes(element.data?.lanes, orientation, orientation === 'horizontal' ? element.height : element.width).length === 1
}

export function areBpmnParticipantLaneHeadersVisible(element: BpmnParticipantElement): boolean {
  if (!canToggleBpmnParticipantSingleLane(element)) return true
  return element.data?.singleLaneVisible !== false
}

export function toggleBpmnParticipantSingleLane(element: BpmnParticipantElement): BpmnParticipantElement {
  if (!canToggleBpmnParticipantSingleLane(element)) return element
  return createBpmnParticipantElement({
    ...element,
    singleLaneVisible: !areBpmnParticipantLaneHeadersVisible(element),
  })
}

export function isElementInsideBpmnParticipantContent(element: ModelerElement, participant: BpmnParticipantElement): boolean {
  return element.id !== participant.id && containsElementRect(createBpmnParticipantLayout(participant).contentRect, element)
}

export function isElementInsideBpmnParticipantLane(element: ModelerElement, participant: BpmnParticipantElement, laneId: string): boolean {
  const lane = createBpmnParticipantLayout(participant).lanes.find(item => item.id === laneId)
  return !!lane && element.id !== participant.id && containsElementRect(lane.contentRect, element)
}

export function addBpmnParticipantLane(element: BpmnParticipantElement, afterLaneId?: string): BpmnParticipantElement {
  const orientation = normalizeBpmnParticipantOrientation(element.data?.orientation)
  const lanes = normalizeBpmnParticipantLanes(element.data?.lanes, orientation, orientation === 'horizontal' ? element.height : element.width)
  const nextIndex = lanes.length + 1
  const nextLane: BpmnParticipantLane = {
    id: createLaneId(lanes, nextIndex),
    name: `Lane ${nextIndex}`,
    size: BPMN_PARTICIPANT_MIN_LANE_SIZE,
  }
  const insertIndex = afterLaneId ? lanes.findIndex(lane => lane.id === afterLaneId) + 1 : lanes.length
  const nextLanes = [
    ...lanes.slice(0, insertIndex < 1 ? lanes.length : insertIndex),
    nextLane,
    ...lanes.slice(insertIndex < 1 ? lanes.length : insertIndex),
  ]
  return createBpmnParticipantElement({
    ...element,
    lanes: nextLanes,
    singleLaneVisible: true,
  })
}

export function removeBpmnParticipantLane(element: BpmnParticipantElement, laneId: string): BpmnParticipantElement {
  const orientation = normalizeBpmnParticipantOrientation(element.data?.orientation)
  const lanes = normalizeBpmnParticipantLanes(element.data?.lanes, orientation, orientation === 'horizontal' ? element.height : element.width)
  if (lanes.length <= 1) return element
  return createBpmnParticipantElement({
    ...element,
    lanes: lanes.filter(lane => lane.id !== laneId),
  })
}

export function resizeBpmnParticipantLaneBoundary(
  element: BpmnParticipantElement,
  laneId: string,
  delta: number,
): BpmnParticipantElement {
  const orientation = normalizeBpmnParticipantOrientation(element.data?.orientation)
  const lanes = normalizeBpmnParticipantLanes(element.data?.lanes, orientation, orientation === 'horizontal' ? element.height : element.width)
  const index = lanes.findIndex(lane => lane.id === laneId)
  const next = index >= 0 ? lanes[index + 1] : undefined
  const current = lanes[index]
  if (!current || !next) return element
  const clampedDelta = Math.max(
    BPMN_PARTICIPANT_MIN_LANE_SIZE - current.size,
    Math.min(next.size - BPMN_PARTICIPANT_MIN_LANE_SIZE, delta),
  )
  return createBpmnParticipantElement({
    ...element,
    lanes: lanes.map((lane, laneIndex) => {
      if (laneIndex === index) return { ...lane, size: lane.size + clampedDelta }
      if (laneIndex === index + 1) return { ...lane, size: lane.size - clampedDelta }
      return lane
    }),
  })
}

export function renameBpmnParticipantLane(element: BpmnParticipantElement, laneId: string, name: string): BpmnParticipantElement {
  return createBpmnParticipantElement({
    ...element,
    lanes: element.data?.lanes?.map(lane => lane.id === laneId ? { ...lane, name } : lane),
  })
}

export function patchBpmnParticipantLaneStyle(
  element: BpmnParticipantElement,
  laneId: string,
  style: ModelerElementStyle,
): BpmnParticipantElement {
  return createBpmnParticipantElement({
    ...element,
    lanes: element.data?.lanes?.map(lane => lane.id === laneId
      ? { ...lane, style: { ...(lane.style ?? {}), ...style } }
      : lane),
  })
}

export function normalizeBpmnParticipantLanes(
  lanes: unknown,
  orientation: BpmnParticipantOrientation,
  totalSize: number,
): Array<BpmnParticipantLane> {
  const raw = Array.isArray(lanes) && lanes.length > 0 ? lanes : [{ id: 'lane-1', name: 'Lane 1', size: totalSize }]
  const normalized = raw.map((lane, index) => {
    const maybeLane = typeof lane === 'object' && lane !== null ? lane as Partial<BpmnParticipantLane> : {}
    return {
      id: normalizeLaneId(maybeLane.id, index),
      name: normalizeName(maybeLane.name, `Lane ${index + 1}`),
      size: finitePositive(maybeLane.size, BPMN_PARTICIPANT_MIN_LANE_SIZE),
      style: normalizeLaneStyle(maybeLane.style),
    }
  })
  return normalizeLaneSizes(normalized, Math.max(resolveLaneTotalMinSize(normalized.length), totalSize), orientation)
}

function normalizeLaneSizes(
  lanes: Array<BpmnParticipantLane>,
  totalSize: number,
  _orientation: BpmnParticipantOrientation,
): Array<BpmnParticipantLane> {
  const minTotal = resolveLaneTotalMinSize(lanes.length)
  const target = Math.max(minTotal, totalSize)
  const current = lanes.reduce((sum, lane) => sum + Math.max(BPMN_PARTICIPANT_MIN_LANE_SIZE, lane.size), 0)
  const ratio = current > 0 ? target / current : 1
  let consumed = 0
  return lanes.map((lane, index) => {
    const remaining = lanes.length - index - 1
    const size = index === lanes.length - 1
      ? Math.max(BPMN_PARTICIPANT_MIN_LANE_SIZE, target - consumed)
      : Math.max(BPMN_PARTICIPANT_MIN_LANE_SIZE, Math.round(Math.max(BPMN_PARTICIPANT_MIN_LANE_SIZE, lane.size) * ratio))
    consumed += size
    const maxAllowed = target - consumed - remaining * BPMN_PARTICIPANT_MIN_LANE_SIZE
    if (maxAllowed < 0 && index !== lanes.length - 1) {
      const adjusted = Math.max(BPMN_PARTICIPANT_MIN_LANE_SIZE, size + maxAllowed)
      consumed += adjusted - size
      return { ...lane, size: adjusted }
    }
    return { ...lane, size }
  })
}

function clampBpmnParticipantSize(
  width: number,
  height: number,
  orientation: BpmnParticipantOrientation,
  laneCount: number,
  laneHeadersVisible: boolean,
): { width: number; height: number } {
  const laneHeaderSize = laneHeadersVisible ? BPMN_PARTICIPANT_LANE_HEADER_SIZE : 0
  if (orientation === 'vertical') {
    return {
      width: Math.max(resolveLaneTotalMinSize(laneCount), width),
      height: Math.max(BPMN_PARTICIPANT_HEADER_SIZE + laneHeaderSize + BPMN_PARTICIPANT_MIN_CONTENT_SIZE, height),
    }
  }
  return {
    width: Math.max(BPMN_PARTICIPANT_HEADER_SIZE + laneHeaderSize + BPMN_PARTICIPANT_MIN_CONTENT_SIZE, width),
    height: Math.max(resolveLaneTotalMinSize(laneCount), height),
  }
}

function normalizeSingleLaneVisible(value: unknown, laneCount: number): boolean {
  if (laneCount !== 1) return true
  return value !== false
}

function resolveLaneTotalMinSize(laneCount: number): number {
  return Math.max(1, laneCount) * BPMN_PARTICIPANT_MIN_LANE_SIZE
}

function containsElementRect(rect: ModelerRect, element: ModelerElement): boolean {
  return element.x >= rect.x
    && element.y >= rect.y
    && element.x + element.width <= rect.x + rect.width
    && element.y + element.height <= rect.y + rect.height
}

function containsRect(rect: ModelerRect, point: { x: number; y: number }): boolean {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height
}

function createLaneId(lanes: Array<BpmnParticipantLane>, index: number): string {
  let candidate = `lane-${index}`
  let suffix = index
  const ids = new Set(lanes.map(lane => lane.id))
  while (ids.has(candidate)) {
    suffix += 1
    candidate = `lane-${suffix}`
  }
  return candidate
}

function normalizeLaneId(value: unknown, index: number): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : `lane-${index + 1}`
}

function normalizeName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function normalizeLaneStyle(value: unknown): ModelerElementStyle | undefined {
  return typeof value === 'object' && value !== null ? { ...(value as ModelerElementStyle) } : undefined
}

function finitePositive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
