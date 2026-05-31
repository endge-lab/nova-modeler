import { NovaAssets } from '@endge/nova'
import toolIconSource from '@/assets/icons/tool.svg?raw'
import brushIconSource from '@/assets/icons/brush.svg?raw'
import trashIconSource from '@/assets/icons/trash.svg?raw'
import settingsIconSource from '@/assets/icons/settings.svg?raw'
import messageIconSource from '@/assets/icons/message.svg?raw'
import timerIconSource from '@/assets/icons/timer.svg?raw'
import errorIconSource from '@/assets/icons/error.svg?raw'
import escalationIconSource from '@/assets/icons/escalation.svg?raw'
import cancelIconSource from '@/assets/icons/cancel.svg?raw'
import compensationIconSource from '@/assets/icons/compensation.svg?raw'
import conditionalIconSource from '@/assets/icons/conditional.svg?raw'
import linkIconSource from '@/assets/icons/link.svg?raw'
import signalIconSource from '@/assets/icons/signal.svg?raw'
import terminateIconSource from '@/assets/icons/terminate.svg?raw'
import multipleIconSource from '@/assets/icons/multiple.svg?raw'
import parallelMultipleIconSource from '@/assets/icons/parallel-multiple.svg?raw'

export const MODELER_ASSETS = NovaAssets.define('nova-modeler', {
  icons: {
    tool: NovaAssets.svg(toolIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    brush: NovaAssets.svg(brushIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    trash: NovaAssets.svg(trashIconSource, { width: 24, height: 24, color: '#dc2626' }),
    settings: NovaAssets.svg(settingsIconSource, { width: 24, height: 24, color: '#111827' }),
    message: NovaAssets.svg(messageIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    timer: NovaAssets.svg(timerIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    error: NovaAssets.svg(errorIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    escalation: NovaAssets.svg(escalationIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    cancel: NovaAssets.svg(cancelIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    compensation: NovaAssets.svg(compensationIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    conditional: NovaAssets.svg(conditionalIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    link: NovaAssets.svg(linkIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    signal: NovaAssets.svg(signalIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    terminate: NovaAssets.svg(terminateIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    multiple: NovaAssets.svg(multipleIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    parallelMultiple: NovaAssets.svg(parallelMultipleIconSource, { width: 24, height: 24, color: '#3f3f46' }),
  },
})

NovaAssets.global.use(MODELER_ASSETS)
