/**
 * Saves a generated report to the user's disk.
 *
 * There is no download permission in the manifest and none is needed: the
 * standard `Blob` + object-URL + synthetic click path works inside a popup and
 * keeps the extension free of a `downloads` permission.
 */

/**
 * Triggers a browser download of `content` as `filename`.
 *
 * The object URL is revoked on a short delay rather than immediately, because
 * revoking it synchronously can cancel the download in some browsers before it
 * has read the blob.
 */
export function downloadTextFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
