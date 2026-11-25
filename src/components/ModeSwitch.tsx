import { BookOpen, FlaskConical } from 'lucide-react'

import { useT } from '../i18n'
import { Segmented } from './ui'

/** Switch between the journal (story + analyses) and the lab (one free workspace). */
export function ModeSwitch({ mode }: { mode: 'journal' | 'lab' }) {
  const t = useT()
  return (
    <Segmented
      value={mode}
      onChange={(value) => (window.location.hash = value === 'lab' ? '#/lab' : '#/')}
      label={t.modes.label}
      options={[
        {
          value: 'journal',
          label: (
            <>
              <BookOpen /> <span className="hidden sm:inline">{t.modes.journal}</span>
            </>
          ),
        },
        {
          value: 'lab',
          label: (
            <>
              <FlaskConical /> <span className="hidden sm:inline">{t.modes.lab}</span>
            </>
          ),
        },
      ]}
    />
  )
}
