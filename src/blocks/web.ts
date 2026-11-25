/**
 * Data from a web address: "hole die Daten von …" fetches a CSV, JSON or
 * GeoJSON file from the internet as text, like "öffne die Datei" opens one
 * from the computer. The generic blocks make data of it. The dropdown offers
 * examples that work from the browser; any other address can be typed in.
 *
 * Not every website lets other pages load its data (CORS): then the run
 * fails at this block, and the explanation says so (blocks/errors).
 */
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pick, t } from '../i18n'
import { categoryNames, needs, SOURCES, stepShape, variableFor } from './program'
import { exampleForUrl, guessKind, isWebAddress, WEB_EXAMPLES, webExample, type WebKind } from './web/examples'

export const LOAD_URL = 'load_url'
SOURCES.add(LOAD_URL)

/** The dropdown's value for an address students typed themselves. */
export const OWN_URL = 'own'

/** Long addresses are cut in the block; clicking the field shows all of it. */
const SHOWN_CHARACTERS = 42

/** The source line under the address: who provides an example's data, or the server of an own address. */
function sourceLine(url: string): string {
  const example = exampleForUrl(url)
  if (example) return t('block.loadUrl.source', { source: example.source })
  try {
    return isWebAddress(url) ? t('block.loadUrl.source', { source: new URL(url.trim()).hostname }) : ''
  } catch {
    return ''
  }
}

/** The two blocks that make a table of what arrives, by its kind; '' if the kind is unknown. */
export function nextSteps(kind: WebKind | null): string {
  if (!kind) return ''
  const [first, second] =
    kind === 'csv' ? ['block.translateCsv', 'block.jsonTable'] : ['block.readJson', kind === 'geojson' ? 'block.geojsonTable' : 'block.jsonTable']
  return t('block.loadUrl.next', { first: t(first), second: t(second), general: categoryNames().general })
}

Blockly.Blocks[LOAD_URL] = {
  init(this: Blockly.Block) {
    this.jsonInit({
      message0: t('block.loadUrl'),
      args0: [
        {
          type: 'field_dropdown',
          name: 'EXAMPLE',
          options: [...WEB_EXAMPLES.map((example) => [pick(example.label) ?? example.id, example.id]), [t('block.loadUrl.own'), OWN_URL]],
        },
      ],
      message1: t('block.loadUrl.address'),
      args1: [{ type: 'field_input', name: 'URL', text: WEB_EXAMPLES[0].url, spellcheck: false }],
      message2: '%1',
      args2: [{ type: 'field_label', name: 'SOURCE', text: sourceLine(WEB_EXAMPLES[0].url) }],
      ...stepShape(['start'], 'text'),
      style: 'web_blocks',
    })
    ;(this.getField('URL') as Blockly.FieldTextInput).maxDisplayLength = SHOWN_CHARACTERS

    // Choosing an example writes its address into the field; another address makes it an own one.
    let filling = false
    this.getField('EXAMPLE')?.setValidator((value: string) => {
      const example = webExample(value)
      filling = true
      if (example) this.setFieldValue(example.url, 'URL')
      filling = false
      return undefined
    })
    this.getField('URL')?.setValidator((value: string) => {
      const url = value.trim()
      if (!filling && !exampleForUrl(url)) this.setFieldValue(OWN_URL, 'EXAMPLE')
      this.setFieldValue(sourceLine(url), 'SOURCE')
      return url
    })

    // In headings and messages: the example's name, or the own address (not every row of the block).
    ;(this as Blockly.Block & { describe: () => string }).describe = () => {
      const url = String(this.getFieldValue('URL') ?? '')
      const example = exampleForUrl(url)
      return t('block.loadUrl').replace('%1', example ? (pick(example.label) ?? example.id) : url)
    }

    // What the chosen example contains and which blocks come next; for an own address, what the block does.
    this.setTooltip(() => {
      const url = String(this.getFieldValue('URL') ?? '')
      const example = exampleForUrl(url)
      const next = nextSteps(guessKind(url))
      if (example) return [pick(example.about), next, t('block.loadUrl.source', { source: example.source })].filter(Boolean).join('\n')
      return next ? `${t('block.loadUrl.tooltip', categoryNames()).split('\n')[0]}\n${next}` : t('block.loadUrl.tooltip', categoryNames())
    })
  },
}

pythonGenerator.forBlock[LOAD_URL] = (block, generator) => {
  const url = String(block.getFieldValue('URL') ?? '').trim()
  block.setWarningText(isWebAddress(url) ? null : url ? t('block.loadUrl.bad', { url }) : t('block.loadUrl.none'), 'url')
  const name = variableFor(block)
  if (!name || !isWebAddress(url)) return ''
  needs(generator, 'from spockly import hole_text')
  return `${name} = hole_text(${JSON.stringify(url)})\n`
}
