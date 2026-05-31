import type {
  ModelerKeyboardShortcut,
  ModelerSelectionModifier,
  ModelerSelectionOptions,
} from '@/domain/types/index'

export interface PointerSelectionInput {
  current: Array<string>
  elementId: string
  event: MouseEvent
  options?: ModelerSelectionOptions
}

export interface RangeSelectionInput {
  current: Array<string>
  ids: Array<string>
  event: MouseEvent
  options?: ModelerSelectionOptions
}

/**
 * Единая точка принятия решений для click/marquee/keyboard selection flows.
 */
export class SelectionRuntime {
  static resolvePointerSelection(input: PointerSelectionInput): Array<string> {
    const options = input.options ?? {}
    if (options.selectOnPointerDown === false) return input.current
    if (options.multiple === false) return [input.elementId]
    if (isModifierActive(input.event, options.toggleModifier)) {
      return toggleIds(input.current, [input.elementId])
    }
    if (isModifierActive(input.event, options.additiveModifier)) {
      return uniqueIds([...input.current, input.elementId])
    }
    return [input.elementId]
  }

  static resolveRangeSelection(input: RangeSelectionInput): Array<string> {
    const options = input.options ?? {}
    if (options.multiple === false) return input.ids.slice(0, 1)
    if (isModifierActive(input.event, options.toggleModifier)) {
      return toggleIds(input.current, input.ids)
    }
    if (isModifierActive(input.event, options.additiveModifier)) {
      return uniqueIds([...input.current, ...input.ids])
    }
    return uniqueIds(input.ids)
  }

  static shouldStartMarquee(event: MouseEvent, options?: ModelerSelectionOptions): boolean {
    if (options?.multiple === false) return false
    return isModifierActive(event, options?.marqueeModifier ?? 'shift')
  }

  static shouldClearOnCanvasPointerDown(options?: ModelerSelectionOptions): boolean {
    return options?.clearOnCanvasPointerDown !== false
  }

  static matchShortcut(event: KeyboardEvent, shortcuts: Array<ModelerKeyboardShortcut> = []): ModelerKeyboardShortcut | undefined {
    return shortcuts.find(shortcut => {
      if (!shortcut.key && !shortcut.code) return false
      if (shortcut.key && shortcut.key !== event.key) return false
      if (shortcut.code && shortcut.code !== event.code) return false
      return (shortcut.shift ?? false) === event.shiftKey
        && (shortcut.ctrl ?? false) === event.ctrlKey
        && (shortcut.meta ?? false) === event.metaKey
        && (shortcut.alt ?? false) === event.altKey
    })
  }
}

function isModifierActive(event: MouseEvent, modifier: ModelerSelectionModifier | undefined): boolean {
  if (!modifier) return false
  if (modifier === 'shift') return event.shiftKey
  if (modifier === 'ctrl') return event.ctrlKey
  if (modifier === 'meta') return event.metaKey
  if (modifier === 'alt') return event.altKey
  return !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
}

function toggleIds(current: Array<string>, ids: Array<string>): Array<string> {
  const next = new Set(current)
  ids.forEach(id => {
    if (next.has(id)) next.delete(id)
    else next.add(id)
  })
  return [...next]
}

function uniqueIds(ids: Array<string>): Array<string> {
  return [...new Set(ids)]
}
