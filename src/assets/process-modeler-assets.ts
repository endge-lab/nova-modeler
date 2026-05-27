import { NovaAssets } from '@endge/nova'
import circleSource from '@/assets/icons/circle.svg?raw'
import diamondSource from '@/assets/icons/diamond.svg?raw'
import plusSource from '@/assets/icons/plus.svg?raw'
import settingsSource from '@/assets/icons/settings.svg?raw'
import squareRoundedSource from '@/assets/icons/square-rounded.svg?raw'
import userSource from '@/assets/icons/user.svg?raw'
import xSource from '@/assets/icons/x.svg?raw'
import type { ProcessNodeKind } from '@/model/types/process-modeler.types'

export const PROCESS_MODELER_ASSET_NAMESPACE = 'endge-process-modeler'

export const PROCESS_MODELER_TABLER_ICON_SVG = Object.freeze({
  circle: circleSource,
  diamond: diamondSource,
  plus: plusSource,
  settings: settingsSource,
  squareRounded: squareRoundedSource,
  user: userSource,
  x: xSource,
})

export const PROCESS_MODELER_ASSETS = NovaAssets.define(PROCESS_MODELER_ASSET_NAMESPACE, {
  icons: {
    circle: NovaAssets.svg(circleSource, { width: 24, height: 24, color: '#1f2937' }),
    circleLight: NovaAssets.svg(circleSource, { width: 24, height: 24, color: '#d7e2ec' }),
    diamond: NovaAssets.svg(diamondSource, { width: 24, height: 24, color: '#1f2937' }),
    diamondLight: NovaAssets.svg(diamondSource, { width: 24, height: 24, color: '#d7e2ec' }),
    plus: NovaAssets.svg(plusSource, { width: 24, height: 24, color: '#1f2937' }),
    plusLight: NovaAssets.svg(plusSource, { width: 24, height: 24, color: '#d7e2ec' }),
    settings: NovaAssets.svg(settingsSource, { width: 24, height: 24, color: '#1f2937' }),
    settingsLight: NovaAssets.svg(settingsSource, { width: 24, height: 24, color: '#d7e2ec' }),
    squareRounded: NovaAssets.svg(squareRoundedSource, { width: 24, height: 24, color: '#1f2937' }),
    squareRoundedLight: NovaAssets.svg(squareRoundedSource, { width: 24, height: 24, color: '#d7e2ec' }),
    user: NovaAssets.svg(userSource, { width: 24, height: 24, color: '#1f2937' }),
    userLight: NovaAssets.svg(userSource, { width: 24, height: 24, color: '#d7e2ec' }),
    x: NovaAssets.svg(xSource, { width: 24, height: 24, color: '#1f2937' }),
    xLight: NovaAssets.svg(xSource, { width: 24, height: 24, color: '#d7e2ec' }),
  },
})

NovaAssets.global.use(PROCESS_MODELER_ASSETS)

export function resolveProcessModelerNodeIconName(kind: ProcessNodeKind, tone: 'dark' | 'light' = 'dark'): keyof typeof PROCESS_MODELER_ASSETS.icons {
  switch (kind) {
    case 'startEvent':
    case 'endEvent':
      return tone === 'light' ? 'circleLight' : 'circle'
    case 'userTask':
      return tone === 'light' ? 'userLight' : 'user'
    case 'serviceTask':
      return tone === 'light' ? 'settingsLight' : 'settings'
    case 'exclusiveGateway':
      return tone === 'light' ? 'xLight' : 'x'
    case 'parallelGateway':
      return tone === 'light' ? 'plusLight' : 'plus'
  }
}

export function resolveProcessModelerNodeIconSvg(kind: ProcessNodeKind): string {
  switch (kind) {
    case 'startEvent':
    case 'endEvent':
      return PROCESS_MODELER_TABLER_ICON_SVG.circle
    case 'userTask':
      return PROCESS_MODELER_TABLER_ICON_SVG.user
    case 'serviceTask':
      return PROCESS_MODELER_TABLER_ICON_SVG.settings
    case 'exclusiveGateway':
      return PROCESS_MODELER_TABLER_ICON_SVG.x
    case 'parallelGateway':
      return PROCESS_MODELER_TABLER_ICON_SVG.plus
  }
}
