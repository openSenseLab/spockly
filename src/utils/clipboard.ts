/**
 * Copy text. The Clipboard API needs a secure context (HTTPS or localhost); over
 * plain http on the local network, fall back to a hidden textarea and execCommand.
 */
export const copyText = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const area = Object.assign(document.createElement('textarea'), { value: text })
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  try {
    return document.execCommand('copy')
  } finally {
    area.remove()
  }
}
