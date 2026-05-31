/**
 * Выполняет браузерное скачивание Blob без смешивания DOM-логики с exporter classes.
 */
export class BrowserDownloadAdapter {
  /**
   * Скачивает Blob через временную ссылку.
   */
  download(blob: Blob, fileName: string): void {
    if (typeof document === 'undefined') return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }
}
