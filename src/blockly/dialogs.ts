import * as Blockly from 'blockly'
import { create } from 'zustand'

export type DialogRequest =
  | { kind: 'alert'; message: string; done: () => void }
  | { kind: 'confirm'; message: string; done: (result: boolean) => void }
  | { kind: 'prompt'; message: string; defaultValue: string; done: (result: string | null) => void }

export const useDialogStore = create<{ request: DialogRequest | null }>(() => ({ request: null }))

/**
 * Blockly asks for text (e.g. new variable names) and confirmations through
 * window.prompt/confirm. Route them through the app's own dialog instead.
 */
export const installBlocklyDialogs = () => {
  const show = (request: DialogRequest) => useDialogStore.setState({ request })
  Blockly.dialog.setAlert((message, callback) => show({ kind: 'alert', message, done: () => callback?.() }))
  Blockly.dialog.setConfirm((message, callback) => show({ kind: 'confirm', message, done: callback }))
  Blockly.dialog.setPrompt((message, defaultValue, callback) =>
    show({ kind: 'prompt', message, defaultValue, done: callback }),
  )
}
