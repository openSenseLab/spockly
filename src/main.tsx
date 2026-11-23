import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { setBlocklyLanguage } from './blockly/locale'
import { installBlocklyDialogs } from './blockly/dialogs'
import { BlocklyDialogs } from './components/BlocklyDialogs'
import { TooltipProvider } from './components/ui'
import { useLanguageStore } from './i18n'
import './index.css'

// Blockly's built-in texts must switch before any workspace re-mounts.
const applyLanguage = (language: 'en' | 'de') => {
  setBlocklyLanguage(language)
  document.documentElement.lang = language
}
applyLanguage(useLanguageStore.getState().language)
useLanguageStore.subscribe((state) => applyLanguage(state.language))
installBlocklyDialogs()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
      <BlocklyDialogs />
    </TooltipProvider>
  </StrictMode>,
)
