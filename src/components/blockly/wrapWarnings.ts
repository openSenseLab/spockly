/**
 * Blockly shows a warning's text in one line, however long: an explanation
 * like "Dieser Block fragt für jeden Sensor …" ran far off the canvas. Here
 * warnings on the canvas are broken into lines first, at spaces.
 */
import * as Blockly from 'blockly'

/** About so many characters per line: a bubble the width of a block or two. */
const LINE_LENGTH = 60

/** The text in lines of at most LINE_LENGTH characters (a longer word gets its own line); its own line breaks stay. */
export function wrapText(text: string, length = LINE_LENGTH): string {
  return text
    .split('\n')
    .map((paragraph) => {
      const lines: string[] = []
      let line = ''
      for (const word of paragraph.split(' ')) {
        if (line && line.length + 1 + word.length > length) {
          lines.push(line)
          line = word
        } else line = line ? `${line} ${word}` : word
      }
      return [...lines, line].join('\n')
    })
    .join('\n')
}

// Only blocks on a canvas: without one there is no bubble, and tests see the text as given.
const setWarningText = Blockly.BlockSvg.prototype.setWarningText
Blockly.BlockSvg.prototype.setWarningText = function (text: string | null, id?: string) {
  return setWarningText.call(this, text ? wrapText(text) : text, id)
}
