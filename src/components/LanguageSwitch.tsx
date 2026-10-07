import { SegmentedControl } from '@radix-ui/themes'

import type { Lang } from '../core/types'
import { lang, setLanguage, t } from '../i18n'
import { saveWorkspaceForReload } from './blockly/carryWorkspace'

export function LanguageSwitch() {
  const onChange = (next: string) => {
    if (next === lang) return
    saveWorkspaceForReload()
    setLanguage(next as Lang)
  }

  return (
    <SegmentedControl.Root value={lang} onValueChange={onChange} aria-label={t('language.label')}>
      <SegmentedControl.Item value="de">Deutsch</SegmentedControl.Item>
      <SegmentedControl.Item value="en">English</SegmentedControl.Item>
    </SegmentedControl.Root>
  )
}
