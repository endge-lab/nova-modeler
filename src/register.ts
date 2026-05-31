import type { NovaSchemaRegistry } from '@endge/nova'
import { registerNovaUIKit } from '@endge/nova-ui-kit'
import { Root } from '@/ui/Root'
import { ZoomControls } from '@/ui/controls/ZoomControls'
import { Background } from '@/ui/layers/Background'
import { Grid } from '@/ui/layers/Grid'
import { MiniMap } from '@/plugins/mini-map/ui/MiniMap'
import { MarqueeSelection } from '@/plugins/marquee-selection/ui/MarqueeSelection'
import { BasicRectView } from '@/ui/elements/basic/BasicRectView'
import { PortView } from '@/ui/handles/PortView'
import { ResizeHandleView } from '@/ui/handles/ResizeHandleView'
import { RotateHandleView } from '@/ui/handles/RotateHandleView'

export function registerModeler(registry: NovaSchemaRegistry): void {
  registerNovaUIKit(registry)
  registry.registerDecorated(Root as never, { override: true })
  registry.registerDecorated(Background as never, { override: true })
  registry.registerDecorated(Grid as never, { override: true })
  registry.registerDecorated(BasicRectView as never, { override: true })
  registry.registerDecorated(PortView as never, { override: true })
  registry.registerDecorated(ResizeHandleView as never, { override: true })
  registry.registerDecorated(RotateHandleView as never, { override: true })
  registry.registerDecorated(MiniMap as never, { override: true })
  registry.registerDecorated(MarqueeSelection as never, { override: true })
  registry.registerDecorated(ZoomControls as never, { override: true })
}
