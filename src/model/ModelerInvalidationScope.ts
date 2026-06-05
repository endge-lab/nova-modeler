import type { ModelerCommitChange } from '@/domain/types'

/**
 * Хранит внутренние версии invalidation kinds для modeler runtime.
 */
export class ModelerInvalidationScope {
  private readonly versions = new Map<ModelerCommitChange, number>()

  bump(kind: ModelerCommitChange): number {
    const next = (this.versions.get(kind) ?? 0) + 1
    this.versions.set(kind, next)
    return next
  }

  bumpMany(kinds: ReadonlyArray<ModelerCommitChange>): void {
    for (const kind of kinds) this.bump(kind)
  }

  get(kind: ModelerCommitChange): number {
    return this.versions.get(kind) ?? 0
  }
}
