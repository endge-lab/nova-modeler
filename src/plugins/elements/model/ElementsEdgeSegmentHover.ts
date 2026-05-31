import type { ModelerEdgeSegmentHandleDescriptor } from '@/domain/types/index'

export class ElementsEdgeSegmentHover {
  private handle: ModelerEdgeSegmentHandleDescriptor | null = null
  private readonly listeners = new Set<() => void>()

  get(): ModelerEdgeSegmentHandleDescriptor | null {
    return this.handle ? { ...this.handle } : null
  }

  set(handle: ModelerEdgeSegmentHandleDescriptor | null): void {
    if (this.isSameHandle(handle)) return
    this.handle = handle ? { ...handle } : null
    this.notify()
  }

  clear(): void {
    this.set(null)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private isSameHandle(next: ModelerEdgeSegmentHandleDescriptor | null): boolean {
    if (!this.handle && !next) return true
    if (!this.handle || !next) return false
    return this.handle.elementId === next.elementId &&
      this.handle.segmentIndex === next.segmentIndex &&
      this.handle.x === next.x &&
      this.handle.y === next.y
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
