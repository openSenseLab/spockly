import * as Blockly from 'blockly'
import { useEffect, useRef } from 'react'

import { useT } from '../i18n'
import { generateCode } from './headless'
import { LIBRARY_CATEGORY, libraryFlyout, registerLibraryMenu } from './library'
import { DATA_CATEGORY, VALUES_CATEGORY, buildDataToolbox, buildToolbox, dataFlyout, valuesFlyout } from './toolbox'
import { migrateWorkspace } from './migrate'

registerLibraryMenu()

type Props = {
  initialState: object | null
  onChange?: (state: object, code: string) => void
  readOnly?: boolean
  variant?: 'data' | 'analysis' | 'lab'
  /** Access to the live workspace, e.g. to add blocks from outside (null when it is disposed). */
  onReady?: (workspace: Blockly.WorkspaceSvg | null) => void
}

const theme = Blockly.Theme.defineTheme('spockly', {
  name: 'spockly',
  base: Blockly.Themes.Zelos,
  fontStyle: { family: 'Mulish Variable, Muli, system-ui, sans-serif', size: 11, weight: '600' },
  componentStyles: {
    workspaceBackgroundColour: '#fbfbfa',
    toolboxBackgroundColour: '#f8f8f6',
    toolboxForegroundColour: '#3f3f3c',
    flyoutBackgroundColour: '#e8f7fc',
    flyoutOpacity: 0.97,
    scrollbarColour: '#d0d0c9',
    scrollbarOpacity: 0.6,
  },
})

/**
 * One Blockly workspace. The parent keys this component by language, so a
 * language switch re-creates the blocks with translated labels.
 */
export function BlocklyEditor({ initialState, onChange, onReady, readOnly = false, variant = 'analysis' }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const t = useT()

  useEffect(() => {
    onChangeRef.current = onChange
    onReadyRef.current = onReady
  }, [onChange, onReady])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const workspace = Blockly.inject(host, {
      toolbox: readOnly
        ? undefined
        : variant === 'data'
          ? buildDataToolbox(t.toolbox)
          : buildToolbox(t.toolbox, { withLoad: variant === 'lab' }),
      readOnly,
      theme,
      renderer: 'geras',
      trashcan: !readOnly,
      // Data cells hold only a few small blocks: no zoom controls, a compact scale.
      sounds: false,
      // Always edit text inline in the block. With modal inputs Blockly falls back to a
      // browser-style prompt on devices it takes for tablets (e.g. Macs with touch support).
      modalInputs: false,
      move: { drag: true, wheel: false, scrollbars: true },
      zoom: readOnly
        ? undefined
        : variant === 'data'
          ? { controls: false, wheel: false, startScale: 0.75 }
          : { controls: true, wheel: true, pinch: true, startScale: 0.8, maxScale: 1.6, minScale: 0.4 },
      grid: readOnly ? undefined : { spacing: 24, length: 2, colour: '#e4e4df', snap: true },
    })

    workspace.registerToolboxCategoryCallback(LIBRARY_CATEGORY, libraryFlyout)
    workspace.registerToolboxCategoryCallback(VALUES_CATEGORY, valuesFlyout)
    workspace.registerToolboxCategoryCallback(DATA_CATEGORY, dataFlyout(false))
    workspace.registerToolboxCategoryCallback(`${DATA_CATEGORY}_LAB`, dataFlyout(true))

    if (initialState) {
      Blockly.Events.disable()
      try {
        Blockly.serialization.workspaces.load(migrateWorkspace(initialState), workspace)
      } finally {
        Blockly.Events.enable()
      }
    }

    if (readOnly) {
      // Size the viewer to its content instead of scrolling inside a fixed box.
      const box = workspace.getBlocksBoundingBox()
      const height = Math.max(80, (box.bottom - box.top) * workspace.scale + 32)
      host.style.height = `${height}px`
      Blockly.svgResize(workspace)
      workspace.scrollCenter()
    }

    let timer: number | undefined
    const emit = () => onChangeRef.current?.(Blockly.serialization.workspaces.save(workspace), generateCode(workspace))
    const listener = (event: Blockly.Events.Abstract) => {
      if (event.isUiEvent || workspace.isDragging()) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = undefined
        emit()
      }, 200)
    }
    if (!readOnly) {
      workspace.addChangeListener(listener)
      emit()
    }

    const observer = new ResizeObserver(() => Blockly.svgResize(workspace))
    observer.observe(host)
    onReadyRef.current?.(workspace)

    return () => {
      onReadyRef.current?.(null)
      // Flush a pending save so nothing is lost when the editor re-mounts (e.g. language switch).
      if (timer !== undefined && !readOnly) emit()
      window.clearTimeout(timer)
      observer.disconnect()
      workspace.dispose()
    }
    // The workspace is created once per mount; later prop changes come from the workspace itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className={readOnly ? 'blockly-host blockly-readonly' : 'blockly-host'} />
}
