import { useEffect } from 'react'
import { Dialog } from '@radix-ui/themes'

import {
  LOAD_FILE,
  LOAD_NASA_POWER,
  LOAD_OSEM,
  LOAD_URL,
  markSetupShown,
  setBlockSetupOpener,
  type FileBlock,
  type NasaBlock,
  type OsemBlock,
  type SetupBlock,
  type UrlBlock,
} from '../blocks'
import { useAppStore } from '../store/useAppStore'
import { getActiveWorkspace } from './blockly/carryWorkspace'
import { FileSetupForm } from './FileSetupForm'
import { NasaSetupForm } from './NasaSetupForm'
import { OsemSetupForm } from './OsemSetupForm'
import { UrlSetupForm } from './UrlSetupForm'

/** The setup window of API load blocks; picks the form by block type. */
export function BlockSetupDialog() {
  const blockId = useAppStore((state) => state.setupBlockId)
  const setBlockId = useAppStore((state) => state.setSetupBlockId)

  useEffect(() => {
    setBlockSetupOpener(setBlockId)
    return () => setBlockSetupOpener(null)
  }, [setBlockId])

  const block = blockId ? (getActiveWorkspace()?.getBlockById(blockId) as SetupBlock | null) : null

  const close = () => {
    // Shown once is enough: don't pop up again for this block.
    if (block) markSetupShown(block)
    setBlockId(null)
  }

  const form =
    block?.type === LOAD_OSEM ? (
      <OsemSetupForm key={block.id} block={block as OsemBlock} onDone={close} />
    ) : block?.type === LOAD_NASA_POWER ? (
      <NasaSetupForm key={block.id} block={block as NasaBlock} onDone={close} />
    ) : block?.type === LOAD_URL ? (
      <UrlSetupForm key={block.id} block={block as UrlBlock} onDone={close} />
    ) : block?.type === LOAD_FILE ? (
      <FileSetupForm key={block.id} block={block as FileBlock} onDone={close} />
    ) : null

  return (
    <Dialog.Root open={!!form} onOpenChange={(open) => !open && close()}>
      <Dialog.Content maxWidth="640px">{form}</Dialog.Content>
    </Dialog.Root>
  )
}
