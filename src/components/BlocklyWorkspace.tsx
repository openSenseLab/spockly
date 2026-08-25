import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'
import 'blockly/blocks'

import { DEFAULT_PYTHON_CODE } from '../constants'
import { useAppStore } from '../store/useAppStore'

type BlocklyWorkspaceProps = {
  workspaceVersion: number
}

const standardToolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Logic',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
        { kind: 'block', type: 'controls_forEach' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_round' },
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_print' },
      ],
    },
    {
      kind: 'category',
      name: 'Lists',
      categorystyle: 'list_category',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_getIndex' },
      ],
    },
    {
      kind: 'category',
      name: 'Variables',
      categorystyle: 'variable_category',
      custom: Blockly.VARIABLE_CATEGORY_NAME,
    },
    {
      kind: 'category',
      name: 'Functions',
      categorystyle: 'procedure_category',
      custom: Blockly.PROCEDURE_CATEGORY_NAME,
    },
  ],
}

const buildPythonPreview = (workspace: Blockly.WorkspaceSvg) => {
  const rawCode = pythonGenerator.workspaceToCode(workspace).trim()

  if (!rawCode) {
    return DEFAULT_PYTHON_CODE
  }

  return rawCode
}

const updateDerivedState = (workspace: Blockly.WorkspaceSvg) => {
  useAppStore.getState().setGeneratedCode(buildPythonPreview(workspace))
  useAppStore.getState().setWorkspaceMetrics({
    totalBlocks: workspace.getAllBlocks(false).length,
    topLevelBlocks: workspace.getTopBlocks(false).length,
  })
}

const resetWorkspaceState = (workspace: Blockly.WorkspaceSvg) => {
  workspace.clear()
  updateDerivedState(workspace)
}

export function BlocklyWorkspace({ workspaceVersion }: BlocklyWorkspaceProps) {
  const blocklyRef = useRef<HTMLDivElement | null>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)

  useEffect(() => {
    if (!blocklyRef.current || workspaceRef.current) {
      return
    }

    const workspace = Blockly.inject(blocklyRef.current, {
      toolbox: standardToolbox,
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

    resetWorkspaceState(workspaceRef.current)
  }, [workspaceVersion])

  return <div className="blockly-workspace" ref={blocklyRef} />
}
