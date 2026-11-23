import { LANGUAGES, useLanguageStore, useT } from '../i18n'
import { Segmented } from './ui'

export function LanguageSwitch() {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const setLanguage = useLanguageStore((state) => state.setLanguage)
  return (
    <Segmented
      value={language}
      onChange={setLanguage}
      label={t.common.language}
      options={LANGUAGES.map((code) => ({ value: code, label: code.toUpperCase() }))}
    />
  )
}
