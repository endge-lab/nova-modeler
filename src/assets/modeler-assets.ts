import { NovaAssets } from '@endge/nova'
import toolIconSource from '@/assets/icons/tool.svg?raw'
import brushIconSource from '@/assets/icons/brush.svg?raw'
import trashIconSource from '@/assets/icons/trash.svg?raw'
import settingsIconSource from '@/assets/icons/settings.svg?raw'
import connectArrowIconSource from '@/assets/icons/arrow-right-circle.svg?raw'
import downloadIconSource from '@/assets/icons/download.svg?raw'
import validationValidIconSource from '@/assets/icons/circle-check.svg?raw'
import validationInvalidIconSource from '@/assets/icons/exclamation-circle.svg?raw'
import messageIconSource from '@/assets/icons/message.svg?raw'
import timerIconSource from '@/assets/icons/timer.svg?raw'
import errorIconSource from '@/assets/icons/error.svg?raw'
import escalationIconSource from '@/assets/icons/escalation.svg?raw'
import cancelIconSource from '@/assets/icons/cancel.svg?raw'
import compensationIconSource from '@/assets/icons/compensation.svg?raw'
import conditionalIconSource from '@/assets/icons/conditional.svg?raw'
import linkIconSource from '@/assets/icons/link.svg?raw'
import textCaptionIconSource from '@/assets/icons/text-caption.svg?raw'
import boxMarginIconSource from '@/assets/icons/box-margin.svg?raw'
import fileTextIconSource from '@/assets/icons/file-text.svg?raw'
import databaseIconSource from '@/assets/icons/database.svg?raw'
import signalIconSource from '@/assets/icons/signal.svg?raw'
import terminateIconSource from '@/assets/icons/terminate.svg?raw'
import multipleIconSource from '@/assets/icons/multiple.svg?raw'
import parallelMultipleIconSource from '@/assets/icons/parallel-multiple.svg?raw'
import userIconSource from '@/assets/icons/user.svg?raw'
import handFingerIconSource from '@/assets/icons/hand-finger.svg?raw'
import fileCodeIconSource from '@/assets/icons/file-code.svg?raw'
import tableIconSource from '@/assets/icons/table.svg?raw'
import sendIconSource from '@/assets/icons/send.svg?raw'
import inboxIconSource from '@/assets/icons/inbox.svg?raw'
import gatewayExclusiveIconSource from '@/assets/icons/gateway-exclusive.svg?raw'
import gatewayParallelIconSource from '@/assets/icons/gateway-parallel.svg?raw'
import gatewayInclusiveIconSource from '@/assets/icons/gateway-inclusive.svg?raw'
import gatewayComplexIconSource from '@/assets/icons/gateway-complex.svg?raw'
import gatewayEventBasedIconSource from '@/assets/icons/gateway-event-based.svg?raw'
import gatewayParallelEventBasedIconSource from '@/assets/icons/gateway-parallel-event-based.svg?raw'
import novaLogoSource from '@/assets/icons/nova-logo.svg?raw'

export const MODELER_ASSETS = NovaAssets.define('nova-modeler', {
  icons: {
    tool: NovaAssets.svg(toolIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    brush: NovaAssets.svg(brushIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    trash: NovaAssets.svg(trashIconSource, { width: 24, height: 24, color: '#dc2626' }),
    settings: NovaAssets.svg(settingsIconSource, { width: 24, height: 24, color: '#111827' }),
    connectArrow: NovaAssets.svg(connectArrowIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    download: NovaAssets.svg(downloadIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    validationValid: NovaAssets.svg(validationValidIconSource, { width: 24, height: 24, color: '#16a34a' }),
    validationInvalid: NovaAssets.svg(validationInvalidIconSource, { width: 24, height: 24, color: '#dc2626' }),
    send: NovaAssets.svg(sendIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    message: NovaAssets.svg(messageIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    timer: NovaAssets.svg(timerIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    error: NovaAssets.svg(errorIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    escalation: NovaAssets.svg(escalationIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    cancel: NovaAssets.svg(cancelIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    compensation: NovaAssets.svg(compensationIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    conditional: NovaAssets.svg(conditionalIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    link: NovaAssets.svg(linkIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    textCaption: NovaAssets.svg(textCaptionIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    boxMargin: NovaAssets.svg(boxMarginIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    fileText: NovaAssets.svg(fileTextIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    database: NovaAssets.svg(databaseIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    signal: NovaAssets.svg(signalIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    terminate: NovaAssets.svg(terminateIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    multiple: NovaAssets.svg(multipleIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    parallelMultiple: NovaAssets.svg(parallelMultipleIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    taskUser: NovaAssets.svg(userIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    taskManual: NovaAssets.svg(handFingerIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    taskService: NovaAssets.svg(settingsIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    taskScript: NovaAssets.svg(fileCodeIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    taskBusinessRule: NovaAssets.svg(tableIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    taskSend: NovaAssets.svg(sendIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    taskReceive: NovaAssets.svg(inboxIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    gatewayExclusive: NovaAssets.svg(gatewayExclusiveIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    gatewayParallel: NovaAssets.svg(gatewayParallelIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    gatewayInclusive: NovaAssets.svg(gatewayInclusiveIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    gatewayComplex: NovaAssets.svg(gatewayComplexIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    gatewayEventBased: NovaAssets.svg(gatewayEventBasedIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    gatewayParallelEventBased: NovaAssets.svg(gatewayParallelEventBasedIconSource, { width: 24, height: 24, color: '#3f3f46' }),
    novaLogo: NovaAssets.svg(novaLogoSource, { width: 1024, height: 1024 }),
  },
})

NovaAssets.global.use(MODELER_ASSETS)
