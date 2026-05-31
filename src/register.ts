import type { NovaSchemaRegistry } from '@endge/nova'
import { registerNovaUIKit } from '@endge/nova-ui-kit'
import '@/assets/modeler-assets'
import { Root } from '@/ui/Root'
import { ContextPad } from '@/ui/controls/ContextPad'
import { BrandLogo } from '@/ui/controls/BrandLogo'
import { BpmnValidationBadge } from '@/ui/controls/BpmnValidationBadge'
import { DownloadControls } from '@/ui/controls/DownloadControls'
import { ElementColorMenu } from '@/ui/controls/ElementColorMenu'
import { ElementVariantMenu } from '@/ui/controls/ElementVariantMenu'
import { Palette } from '@/ui/controls/Palette'
import { ZoomControls } from '@/ui/controls/ZoomControls'
import { Background } from '@/ui/layers/Background'
import { Grid } from '@/ui/layers/Grid'
import { MiniMap } from '@/plugins/mini-map/ui/MiniMap'
import { MarqueeSelection } from '@/plugins/marquee-selection/ui/MarqueeSelection'
import { BasicRectView } from '@/ui/elements/basic/BasicRectView'
import { BpmnGroupView } from '@/ui/elements/bpmn/artifacts/group/BpmnGroupView'
import { BpmnTextAnnotationView } from '@/ui/elements/bpmn/artifacts/text-annotation/BpmnTextAnnotationView'
import { BpmnAssociationView } from '@/ui/elements/bpmn/association/BpmnAssociationView'
import { BpmnDataObjectView } from '@/ui/elements/bpmn/data/data-object/BpmnDataObjectView'
import { BpmnDataStoreView } from '@/ui/elements/bpmn/data/data-store/BpmnDataStoreView'
import { BpmnEventView } from '@/ui/elements/bpmn/event/BpmnEventView'
import { BpmnFlowView } from '@/ui/elements/bpmn/flow/BpmnFlowView'
import { BpmnGatewayView } from '@/ui/elements/bpmn/gateway/BpmnGatewayView'
import { BpmnTaskView } from '@/ui/elements/bpmn/task/BpmnTaskView'
import { EdgeWaypointHandleView } from '@/ui/handles/EdgeWaypointHandleView'
import { PortView } from '@/ui/handles/PortView'
import { ResizeHandleView } from '@/ui/handles/ResizeHandleView'
import { RotateHandleView } from '@/ui/handles/RotateHandleView'
import { MODELER_SETTINGS_DIALOG_DESCRIPTOR } from '@/ui/settings/SettingsDialog'
import { SettingsButton } from '@/ui/settings/SettingsButton'
import { MODELER_SETTINGS_CATEGORY_DESCRIPTOR } from '@/ui/settings/SettingsCategory'
import { MODELER_SETTINGS_SECTION_DESCRIPTOR } from '@/ui/settings/SettingsSection'
import { MODELER_BPMN_VALIDATION_DIALOG_DESCRIPTOR } from '@/ui/validation/BpmnValidationDialog'

export function registerModeler(registry: NovaSchemaRegistry): void {
  registerNovaUIKit(registry)
  registry.registerDecorated(Root as never, { override: true })
  registry.registerDecorated(Background as never, { override: true })
  registry.registerDecorated(Grid as never, { override: true })
  registry.registerDecorated(BasicRectView as never, { override: true })
  registry.registerDecorated(BpmnAssociationView as never, { override: true })
  registry.registerDecorated(BpmnFlowView as never, { override: true })
  registry.registerDecorated(BpmnEventView as never, { override: true })
  registry.registerDecorated(BpmnGatewayView as never, { override: true })
  registry.registerDecorated(BpmnTaskView as never, { override: true })
  registry.registerDecorated(BpmnTextAnnotationView as never, { override: true })
  registry.registerDecorated(BpmnGroupView as never, { override: true })
  registry.registerDecorated(BpmnDataObjectView as never, { override: true })
  registry.registerDecorated(BpmnDataStoreView as never, { override: true })
  registry.registerDecorated(EdgeWaypointHandleView as never, { override: true })
  registry.registerDecorated(PortView as never, { override: true })
  registry.registerDecorated(ResizeHandleView as never, { override: true })
  registry.registerDecorated(RotateHandleView as never, { override: true })
  registry.registerDecorated(MiniMap as never, { override: true })
  registry.registerDecorated(MarqueeSelection as never, { override: true })
  registry.registerDecorated(ContextPad as never, { override: true })
  registry.registerDecorated(BrandLogo as never, { override: true })
  registry.registerDecorated(BpmnValidationBadge as never, { override: true })
  registry.registerDecorated(DownloadControls as never, { override: true })
  registry.registerDecorated(ElementColorMenu as never, { override: true })
  registry.registerDecorated(ElementVariantMenu as never, { override: true })
  registry.registerDecorated(Palette as never, { override: true })
  registry.registerDecorated(ZoomControls as never, { override: true })
  registry.register(MODELER_SETTINGS_DIALOG_DESCRIPTOR, { override: true })
  registry.register(MODELER_BPMN_VALIDATION_DIALOG_DESCRIPTOR, { override: true })
  registry.registerDecorated(SettingsButton as never, { override: true })
  registry.register(MODELER_SETTINGS_CATEGORY_DESCRIPTOR, { override: true })
  registry.register(MODELER_SETTINGS_SECTION_DESCRIPTOR, { override: true })
}
