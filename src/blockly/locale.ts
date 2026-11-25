import * as Blockly from 'blockly'
import * as De from 'blockly/msg/de'
import * as En from 'blockly/msg/en'

import type { Language } from '../i18n'

const locales = { de: De, en: En } as unknown as Record<Language, Record<string, string>>

/** Built-in Blockly blocks and menus use Blockly.Msg; switch them with the UI language. */
export const setBlocklyLanguage = (language: Language) => Blockly.setLocale(locales[language])
