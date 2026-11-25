import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { de } from './de'
import { en, type Messages } from './en'

export type Language = 'en' | 'de'
export const LANGUAGES: Language[] = ['en', 'de']

const dictionaries: Record<Language, Messages> = { en, de }

const detectLanguage = (): Language =>
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('de')
    ? 'de'
    : 'en'

type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: detectLanguage(),
      setLanguage: (language) => set({ language }),
    }),
    { name: 'spockly-language' },
  ),
)

export const getMessages = (language: Language = useLanguageStore.getState().language) =>
  dictionaries[language]

/** React hook returning the message tree for the active UI language. */
export const useT = () => dictionaries[useLanguageStore((state) => state.language)]

/** Replace `{name}` placeholders in a message. */
export const format = (message: string, values: Record<string, string | number>) =>
  message.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )

export type { Messages }
