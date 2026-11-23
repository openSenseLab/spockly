/**
 * Tiny Markdown renderer for journal text cells.
 *
 * Everything is HTML-escaped *before* formatting, and links only allow
 * http(s)/mailto, so journals opened from shared links cannot inject markup.
 * Supported: # headings, **bold**, *italic*, `code`, [links](https://…),
 * - / 1. lists, > quotes, --- rules and paragraphs.
 */

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const inline = (text: string) =>
  escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, (_, label: string, url: string) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
    })

export const renderMarkdown = (source: string) => {
  const html: string[] = []
  let paragraph: string[] = []
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null
  let quote: string[] = []

  const flush = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`)
    if (list) html.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`)
    if (quote.length) html.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`)
    paragraph = []
    list = null
    quote = []
  }

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd()
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const quoteLine = line.match(/^>\s?(.*)$/)

    if (!line.trim()) {
      flush()
    } else if (heading) {
      flush()
      const level = heading[1].length + 1 // the journal title is the h1
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush()
      html.push('<hr>')
    } else if (bullet || ordered) {
      const tag = bullet ? 'ul' : 'ol'
      if (paragraph.length || quote.length || (list && list.tag !== tag)) flush()
      list ??= { tag, items: [] }
      list.items.push((bullet ?? ordered)![1])
    } else if (quoteLine) {
      if (paragraph.length || list) flush()
      quote.push(quoteLine[1])
    } else {
      if (list || quote.length) flush()
      paragraph.push(line)
    }
  }
  flush()
  return html.join('\n')
}
