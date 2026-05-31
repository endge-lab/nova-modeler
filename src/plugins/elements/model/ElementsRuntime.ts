import { ElementsBounds } from '@/plugins/elements/model/ElementsBounds'
import { ElementsConnection } from '@/plugins/elements/model/ElementsConnection'
import { ElementsConnectionFlow } from '@/plugins/elements/model/ElementsConnectionFlow'
import { ElementsDragShadow } from '@/plugins/elements/model/ElementsDragShadow'
import { ElementsEdgePreview } from '@/plugins/elements/model/ElementsEdgePreview'
import { ElementsEdges } from '@/plugins/elements/model/ElementsEdges'
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
  readonly edges = new ElementsEdges(this.geometry, this.ports)
  readonly connection = new ElementsConnection(this.geometry, this.ports)
  readonly dragShadow = new ElementsDragShadow()
  readonly edgePreview = new ElementsEdgePreview()
  readonly connectionFlow = new ElementsConnectionFlow(this.connection, this.edgePreview)
}

export const MODEL_ELEMENTS_RUNTIME = new ElementsRuntime()
