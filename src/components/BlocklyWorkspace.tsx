import { useEffect, useRef } from "react";
import * as Blockly from "blockly";
import { pythonGenerator } from "blockly/python";
import "blockly/blocks";

import { DEFAULT_PYTHON_CODE } from "../constants";
import { useAppStore } from "../store/useAppStore";
import { getToolboxForMode } from "./blockly/modes";
import "./blockly/blocks/example";
import "./blockly/blocks/generators/example";

type BlocklyWorkspaceProps = {
  workspaceVersion: number;
};

const buildPythonPreview = (workspace: Blockly.WorkspaceSvg) => {
  const rawCode = pythonGenerator.workspaceToCode(workspace).trim();

  if (!rawCode) {
    return DEFAULT_PYTHON_CODE;
  }

  return rawCode;
};

const updateDerivedState = (workspace: Blockly.WorkspaceSvg) => {
  useAppStore.getState().setGeneratedCode(buildPythonPreview(workspace));
  useAppStore.getState().setWorkspaceMetrics({
    totalBlocks: workspace.getAllBlocks(false).length,
    topLevelBlocks: workspace.getTopBlocks(false).length,
  });
  // Any workspace change means the previously generated results no longer
  // correspond to the current blocks.
  useAppStore.getState().setResultsStale(true);
};

const resetWorkspaceState = (workspace: Blockly.WorkspaceSvg) => {
  workspace.clear();
  updateDerivedState(workspace);
};

export function BlocklyWorkspace({ workspaceVersion }: BlocklyWorkspaceProps) {
  const blocklyRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const dsMode = useAppStore((state) => state.dsMode);

  // Inject (or re-inject) the workspace whenever the branch (dsMode) changes.
  // Switching branches is a deliberate action, so losing workspace state is
  // acceptable (like switching git branches).
  useEffect(() => {
    if (!blocklyRef.current) {
      return;
    }

    // Dispose any existing workspace before re-injecting.
    if (workspaceRef.current) {
      workspaceRef.current.dispose();
      workspaceRef.current = null;
    }

    const workspace = Blockly.inject(blocklyRef.current, {
      toolbox: getToolboxForMode(dsMode),
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
        colour: "#d4d4d8",
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
    });

    const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) {
        return;
      }

      updateDerivedState(workspace);
    };

    const onResize = () => Blockly.svgResize(workspace);

    workspace.addChangeListener(onWorkspaceChange);
    workspaceRef.current = workspace;
    window.addEventListener("resize", onResize);
    onResize();
    // Refresh the generated code and metrics immediately after injection so the
    // preview reflects the current (possibly empty) workspace.
    updateDerivedState(workspace);

    return () => {
      window.removeEventListener("resize", onResize);
      workspace.removeChangeListener(onWorkspaceChange);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [dsMode]);

  useEffect(() => {
    if (!workspaceRef.current) {
      return;
    }

    resetWorkspaceState(workspaceRef.current);
  }, [workspaceVersion]);

  return <div className="blockly-workspace" ref={blocklyRef} />;
}
