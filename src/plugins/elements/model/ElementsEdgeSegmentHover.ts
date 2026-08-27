import type { ModelerEdgeSegmentHandleDescriptor } from '@/domain/types/index'

export class ElementsEdgeSegmentHover {
  private _handle: ModelerEdgeSegmentHandleDescriptor | null = null
  private readonly _listeners = new Set<() => void>()

  get(): ModelerEdgeSegmentHandleDescriptor | null {
    return this._handle ? { ...this._handle } : null
  }

  set(handle: ModelerEdgeSegmentHandleDescriptor | null): void {
    if (this._isSameHandle(handle)) {
      return
    }
    this._handle = handle ? { ...handle } : null
    this._notify()
  }

  clear(): void {
    this.set(null)
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _isSameHandle(next: ModelerEdgeSegmentHandleDescriptor | null): boolean {
    if (!this._handle && !next) {
      return true
    }
    if (!this._handle || !next) {
      return false
    }
    return this._handle.elementId === next.elementId
      && this._handle.segmentIndex === next.segmentIndex
      && this._handle.x === next.x
      && this._handle.y === next.y
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }
}
