// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import { emptyReason, isEmpty } from './empty'
import './index'
import { blockText } from './program'

/** A dataset: the openSenseMap block (id holen) with these fields, then "übersetze den JSON-Text" (id json). */
function fetching(fields: Record<string, unknown>) {
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'spockly_dataset', inputs: { STEPS: { block: { type: 'osem_fetch', id: 'holen', fields, next: { block: { type: 'step_read_json', id: 'json' } } } } } }],
      },
    },
    workspace,
  )
  return workspace
}

describe('data that came out empty', () => {
  it('is an empty list or object as text, no entries, or a table of no rows', () => {
    expect(isEmpty({ art: 'text', text: '[]', anzahl: 2 })).toBe(true)
    expect(isEmpty({ art: 'text', text: ' {} ', anzahl: 4 })).toBe(true)
    expect(isEmpty({ art: 'json', text: '[]', anzahl: 0 })).toBe(true)
    expect(isEmpty({ art: 'tabelle', spalten: [], typen: {}, zeilen: [], anzahl: 0 } as never)).toBe(true)
    expect(isEmpty({ art: 'text', text: '[{"_id": "1"}]', anzahl: 14 })).toBe(false)
    expect(isEmpty({ art: 'json', text: '[…]', anzahl: 3 })).toBe(false)
  })

  it('says why after the openSenseMap block, and in the steps below it', () => {
    const area = fetching({ MODE: 'area', OUTDOOR: true })
    expect(emptyReason(area.getBlockById('holen')!)).toBe(
      'In diesem Gebiet hat die openSenseMap keine Stationen im Freien. Nimm ein größeres oder ein anderes Gebiet, oder nimm den Haken bei „nur Stationen im Freien“ weg.',
    )
    expect(emptyReason(area.getBlockById('json')!)).toContain('keine Stationen im Freien')
    expect(emptyReason(fetching({ MODE: 'ids' }).getBlockById('holen')!)).toContain('Die openSenseMap kennt keine der Stationen im Block')
  })

  it('has no reason for other data', () => {
    const workspace = new Blockly.Workspace()
    expect(emptyReason(workspace.newBlock('step_read_json'))).toBe(true)
  })
})

describe('the openSenseMap block in a few words', () => {
  it('names the area, or the IDs, not every row', () => {
    expect(blockText(fetching({ MODE: 'area', PRESET: 'muenster' }).getBlockById('holen')!)).toBe(
      'hole von openSenseMap die Stationen im Gebiet Münster – ganze Stadt',
    )
    expect(blockText(fetching({ MODE: 'area', PRESET: 'custom', BBOX: '1,2,3,4' }).getBlockById('holen')!)).toBe(
      'hole von openSenseMap die Stationen in einem eigenen Gebiet',
    )
    expect(blockText(fetching({ MODE: 'ids' }).getBlockById('holen')!)).toBe(
      'hole von openSenseMap die Stationen mit der ID 625c512a18aca4001cadae87',
    )
  })
})
