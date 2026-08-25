import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'
import 'blockly/blocks'

import { registerSpatialBlocks, spatialToolbox } from '../blocks/spatialBlocks'
import { useAppStore } from '../store/useAppStore'

type BlocklyWorkspaceProps = {
  starterXml: string
  workspaceVersion: number
}

const fallbackCode = `import geopandas as gpd\n\n# Assemble a spatial workflow with blocks to generate Python.`

const updateDerivedState = (workspace: Blockly.WorkspaceSvg) => {
  const generatedCode = pythonGenerator.workspaceToCode(workspace).trim()
  useAppStore.getState().setGeneratedCode(generatedCode || fallbackCode)
  useAppStore.getState().setWorkspaceMetrics({
    totalBlocks: workspace.getAllBlocks(false).length,
    topLevelBlocks: workspace.getTopBlocks(false).length,
  })
}

const loadStarterWorkspace = (workspace: Blockly.WorkspaceSvg, starterXml: string) => {
  const xml = Blockly.utils.xml.textToDom(starterXml)
  Blockly.Xml.clearWorkspaceAndLoadFromXml(xml, workspace)
  updateDerivedState(workspace)
}

export function BlocklyWorkspace({ starterXml, workspaceVersion }: BlocklyWorkspaceProps) {
  const blocklyRef = useRef<HTMLDivElement | null>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)

  useEffect(() => {
    registerSpatialBlocks()
  }, [])

  useEffect(() => {
    if (!blocklyRef.current || workspaceRef.current) {
      return
    }

    const workspace = Blockly.inject(blocklyRef.current, {
      toolbox: spatialToolbox,
      theme: Blockly.Themes.Zelos,
      trashcan: true,
      move: {
        drag: true,
        wheel: true,
        scrollbars: true,
      },
      grid: {
        spacing: 24,
        length: 3,
        colour: '#d4d4d8',
        snap: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.95,
        maxScale: 1.5,
        minScale: 0.4,
        scaleSpeed: 1.1,
      },
    })

    const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) {
        return
      }

      updateDerivedState(workspace)
    }

    const onResize = () => Blockly.svgResize(workspace)

    workspace.addChangeListener(onWorkspaceChange)
    workspaceRef.current = workspace
    window.addEventListener('resize', onResize)
    onResize()

    return () => {
      window.removeEventListener('resize', onResize)
      workspace.removeChangeListener(onWorkspaceChange)
      workspace.dispose()
      workspaceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!workspaceRef.current) {
      return
    }

    loadStarterWorkspace(workspaceRef.current, starterXml)
  }, [starterXml, workspaceVersion])

  return <div className="blockly-workspace" ref={blocklyRef} />
}
