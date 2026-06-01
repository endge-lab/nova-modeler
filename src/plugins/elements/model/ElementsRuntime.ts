import { ConnectionAnchorResolver } from '@/plugins/elements/model/ConnectionAnchorResolver'
import { ElementsBounds } from '@/plugins/elements/model/ElementsBounds'
import { ElementsConnection } from '@/plugins/elements/model/ElementsConnection'
import { ElementsConnectionFlow } from '@/plugins/elements/model/ElementsConnectionFlow'
import { ElementsConnectionWarnings } from '@/plugins/elements/model/ElementsConnectionWarnings'
import { ElementsContextPadAnchors } from '@/plugins/elements/model/ElementsContextPadAnchors'
import { ElementsDragShadow } from '@/plugins/elements/model/ElementsDragShadow'
import { ElementsEdgeSegmentHover } from '@/plugins/elements/model/ElementsEdgeSegmentHover'
import { ElementsEdgePreview } from '@/plugins/elements/model/ElementsEdgePreview'
import { ElementsEdges } from '@/plugins/elements/model/ElementsEdges'
import { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'
import { ElementsHandles } from '@/plugins/elements/model/ElementsHandles'
import { ElementsPorts } from '@/plugins/elements/model/ElementsPorts'
import { ElementsRouteOptimizer } from '@/plugins/elements/model/ElementsRouteOptimizer'

/**
 * Собирает локальные services graph-elements plugin.
 */
export class ElementsRuntime {
  readonly geometry = new ElementsGeometry()
  readonly bounds = new ElementsBounds()
  readonly handles = new ElementsHandles(this.geometry)
  readonly ports = new ElementsPorts(this.geometry)
  readonly anchors = new ConnectionAnchorResolver(this.geometry)
  readonly edges = new ElementsEdges(this.geometry, this.ports, this.anchors)
  readonly routeOptimizer = new ElementsRouteOptimizer(this.geometry, this.edges)
  readonly connection = new ElementsConnection(this.geometry, this.ports, this.anchors)
  readonly dragShadow = new ElementsDragShadow()
  readonly edgeSegmentHover = new ElementsEdgeSegmentHover()
  readonly edgePreview = new ElementsEdgePreview()
  readonly contextPadAnchors = new ElementsContextPadAnchors()
  readonly connectionWarnings = new ElementsConnectionWarnings()
  readonly connectionFlow = new ElementsConnectionFlow(this.connection, this.edgePreview)
}

export const MODEL_ELEMENTS_RUNTIME = new ElementsRuntime()
