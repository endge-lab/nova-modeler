import { ElementsBounds } from '@/plugins/elements/model/ElementsBounds'
import { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'
import { ElementsHandles } from '@/plugins/elements/model/ElementsHandles'
import { ElementsPorts } from '@/plugins/elements/model/ElementsPorts'

/**
 * Собирает локальные services graph-elements plugin.
 */
export class ElementsRuntime {
  readonly geometry = new ElementsGeometry()
  readonly bounds = new ElementsBounds()
  readonly handles = new ElementsHandles(this.geometry)
  readonly ports = new ElementsPorts(this.geometry)
}

export const MODEL_ELEMENTS_RUNTIME = new ElementsRuntime()
