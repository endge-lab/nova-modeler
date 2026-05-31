import type {
  ModelerElement,
  ModelerPort,
} from '@/domain/types/index'
import type { ElementsGeometry } from '@/plugins/elements/model/ElementsGeometry'

/**
 * Подготавливает runtime ports для элемента.
 */
export class ElementsPorts {
  constructor(private readonly geometry: ElementsGeometry) {}

  /**
   * Возвращает ports с учетом rotation элемента.
   */
  createElementPorts(element: ModelerElement, ports: Array<ModelerPort>): Array<ModelerPort> {
    return ports.map(port => ({
      ...port,
      ...this.geometry.rotatePoint(element, port),
    }))
  }
}
