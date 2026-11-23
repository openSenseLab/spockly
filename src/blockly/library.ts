import * as Blockly from 'blockly'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getMessages } from '../i18n'
import { idbStorage } from '../journal/idbStorage'
import { newId } from '../utils/id'

/**
 * "My blocks": block groups a learner saved for reuse. They live in the browser,
 * independent of any journal, and appear as a toolbox category in every workspace.
 */
export type Snippet = {
  id: string
  name: string
  /** Serialized root block including its inputs and the blocks below it. */
  state: Blockly.serialization.blocks.State
  blockCount: number
  createdAt: string
}

type LibraryState = {
  snippets: Snippet[]
  add: (name: string, state: Blockly.serialization.blocks.State) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  importSnippets: (snippets: Snippet[]) => number
}

const countBlocks = (state: unknown): number => {
  if (!state || typeof state !== 'object') return 0
  if (Array.isArray(state)) return state.reduce((sum, item) => sum + countBlocks(item), 0)
  const record = state as Record<string, unknown>
  const own = typeof record.type === 'string' && !('kind' in record) ? 1 : 0
  return own + Object.values(record).reduce<number>((sum, value) => sum + countBlocks(value), 0)
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      snippets: [],
      add: (name, state) =>
        set(({ snippets }) => ({
          snippets: [
            ...snippets,
            { id: newId(), name, state, blockCount: countBlocks(state), createdAt: new Date().toISOString() },
          ],
        })),
      rename: (id, name) =>
        set(({ snippets }) => ({ snippets: snippets.map((s) => (s.id === id ? { ...s, name } : s)) })),
      remove: (id) => set(({ snippets }) => ({ snippets: snippets.filter((s) => s.id !== id) })),
      importSnippets: (incoming) => {
        const valid = incoming.filter((s) => s && typeof s.name === 'string' && s.state && typeof s.state.type === 'string')
        const known = new Set(get().snippets.map((s) => JSON.stringify(s.state)))
        const fresh = valid
          .filter((s) => !known.has(JSON.stringify(s.state)))
          .map((s) => ({ ...s, id: newId(), blockCount: countBlocks(s.state) }))
        set(({ snippets }) => ({ snippets: [...snippets, ...fresh] }))
        return fresh.length
      },
    }),
    { name: 'spockly-library', version: 1, storage: createJSONStorage(() => idbStorage) },
  ),
)

export const LIBRARY_CATEGORY = 'SPK_LIBRARY'

/** Flyout contents of the "My blocks" category, built each time it opens. */
export const libraryFlyout = (): Blockly.utils.toolbox.FlyoutItemInfoArray => {
  const t = getMessages().library
  const snippets = useLibraryStore.getState().snippets
  if (!snippets.length) return [{ kind: 'label', text: t.empty }]
  return snippets.flatMap((snippet) => [
    { kind: 'label', text: snippet.name },
    { kind: 'block', ...snippet.state } as Blockly.utils.toolbox.BlockInfo,
  ])
}

/** Suggested name: the clicked block's own text without nested blocks, e.g. "use dataset stations". */
const blockLabel = (block: Blockly.Block) =>
  block.inputList
    .flatMap((input) => input.fieldRow.map((field) => field.getText()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)

let registered = false

/** Adds "Save to my blocks" to every block's context menu (once per page). */
export const registerLibraryMenu = () => {
  if (registered) return
  registered = true
  Blockly.ContextMenuRegistry.registry.register({
    id: 'spk_save_to_library',
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    weight: -10,
    displayText: () => getMessages().library.saveMenu,
    preconditionFn: (scope) => (scope.block && !scope.block.isInFlyout ? 'enabled' : 'hidden'),
    callback: (scope) => {
      const block = scope.block
      if (!block) return
      const state = Blockly.serialization.blocks.save(block, {
        addCoordinates: false,
        addNextBlocks: true,
        saveIds: false,
        doFullSerialization: true,
      })
      if (!state) return
      const t = getMessages().library
      Blockly.dialog.prompt(t.savePrompt, blockLabel(block), (name) => {
        if (name === null) return
        useLibraryStore.getState().add(name.trim() || t.defaultName, state)
        if (block.workspace instanceof Blockly.WorkspaceSvg) {
          Blockly.dialog.toast(block.workspace, { message: t.saved.replace('{name}', name.trim() || t.defaultName) })
        }
      })
    },
  })
}
