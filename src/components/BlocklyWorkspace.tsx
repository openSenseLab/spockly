import { useEffect, useRef } from "react";
import * as Blockly from "blockly";
import * as BlocklyDe from "blockly/msg/de";
import "blockly/blocks";

import {
  followRename,
  generate,
  adviceFor,
  markRunState,
  ranAsItIs,
  refreshFieldLabels,
  spocklyTheme,
  toolbox,
} from "../blocks";
import { DEFAULT_PYTHON_CODE } from "../constants";
import { lang } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import { carriedState, setActiveWorkspace } from "./blockly/carryWorkspace";
import { quickTooltips } from "./blockly/quickTooltips";
import "./blockly/wrapWarnings";

if (lang === "de") {
  Blockly.setLocale(BlocklyDe as unknown as Record<string, string>);
}

/**
 * Dropdown menus stay inside the visible screen rather than inside the
 * workspace box, which on a phone is narrower and shorter than a menu (App.css
 * lets them stick out of the box). Blockly sets the workspace as the limit
 * every time a menu opens and offers no option for this, only its internal
 * getBoundsInfo, so that is replaced here (page coordinates, like Blockly's
 * own). If a Blockly update removes it, menus go back to the workspace box.
 */
const dropDownInternals = Blockly.DropDownDiv.TEST_ONLY as
  | { getBoundsInfo?: () => unknown }
  | undefined;
if (typeof dropDownInternals?.getBoundsInfo === "function") {
  dropDownInternals.getBoundsInfo = () => {
    const [left, top] = [window.scrollX, window.scrollY];
    const [width, height] = [
      document.documentElement.clientWidth,
      document.documentElement.clientHeight,
    ];
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  };
}

type BlocklyWorkspaceProps = {
  workspaceVersion: number;
};

const updateDerivedState = (workspace: Blockly.WorkspaceSvg) => {
  const { shown, run } = generate(workspace);
  useAppStore
    .getState()
    .setGeneratedCode(shown || DEFAULT_PYTHON_CODE, run || DEFAULT_PYTHON_CODE);
  useAppStore.getState().setWorkspaceMetrics({
    totalBlocks: workspace.getAllBlocks(false).length,
    topLevelBlocks: workspace.getTopBlocks(false).length,
  });
};

/** The warning id of advice after a run, apart from the blocks' own warnings. */
const ADVICE_WARNING = "advice";

/** Marks the blocks the last run didn't cover: new or changed since, or after a failed block. */
const markRun = (workspace: Blockly.WorkspaceSvg) => {
  const { lastRun, snapshots, filesVersion } = useAppStore.getState();
  markRunState(workspace, lastRun?.signatures ?? null, snapshots, filesVersion);
  // Advice on a block whose result the run left as it is (e.g. a table of one row from GeoJSON).
  // Again after each change: generating the code clears the blocks' warnings.
  for (const block of workspace.getAllBlocks(false)) {
    const current = lastRun !== null && ranAsItIs(block, lastRun.signatures, snapshots, filesVersion);
    block.setWarningText(current ? adviceFor(block, snapshots) : null, ADVICE_WARNING);
  }
};

const resetWorkspaceState = (workspace: Blockly.WorkspaceSvg) => {
  workspace.clear();
  updateDerivedState(workspace);
};

export function BlocklyWorkspace({ workspaceVersion }: BlocklyWorkspaceProps) {
  const blocklyRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const firstVersion = useRef(workspaceVersion);

  useEffect(() => {
    if (!blocklyRef.current || workspaceRef.current) {
      return;
    }

    const workspace = Blockly.inject(blocklyRef.current, {
      toolbox,
      renderer: "zelos",
      theme: spocklyTheme,
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
        startScale: 0.9,
        maxScale: 1.5,
        minScale: 0.4,
        scaleSpeed: 1.1,
      },
    });

    const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
      // Clicking a block shows what the data looked like after it (its Zwischenstand).
      // Deselecting keeps it: clicking into the panel to scroll takes the focus from Blockly,
      // which deselects the block, and the Zwischenstand would vanish.
      if (event.type === Blockly.Events.SELECTED) {
        const { newElementId } = event as Blockly.Events.Selected;
        if (newElementId)
          useAppStore.getState().setSelectedBlockId(newElementId);
        return;
      }
      if (event.isUiEvent) {
        return;
      }
      followRename(event, workspace);
      updateDerivedState(workspace);
      // E.g. the map now shows another dataset: its colour column may be missing there.
      refreshFieldLabels(workspace);
      markRun(workspace);
    };

    const onResize = () => Blockly.svgResize(workspace);

    workspace.addChangeListener(onWorkspaceChange);
    const stopQuickTooltips = quickTooltips(workspace);
    // A run brings the columns: a chosen column that isn't there any more then reads "– fehlt".
    // A run, or a newly picked file, changes which blocks are up to date.
    const stopLabels = useAppStore.subscribe((state, before) => {
      if (state.snapshots !== before.snapshots) refreshFieldLabels(workspace);
      if (state.snapshots !== before.snapshots || state.lastRun !== before.lastRun || state.filesVersion !== before.filesVersion)
        markRun(workspace);
    });
    workspaceRef.current = workspace;
    setActiveWorkspace(workspace);
    window.addEventListener("resize", onResize);
    onResize();

    // The blocks come back after the reload of a language switch.
    if (carriedState) {
      try {
        Blockly.serialization.workspaces.load(carriedState, workspace);
      } catch (error) {
        console.error("[workspace] could not restore blocks", error);
      }
    }

    return () => {
      window.removeEventListener("resize", onResize);
      stopQuickTooltips();
      stopLabels();
      workspace.removeChangeListener(onWorkspaceChange);
      workspace.dispose();
      workspaceRef.current = null;
      setActiveWorkspace(null);
    };
  }, []);

  useEffect(() => {
    // Only "clear the canvas" bumps the version; the first render keeps restored blocks.
    if (!workspaceRef.current || workspaceVersion === firstVersion.current) {
      return;
    }

    resetWorkspaceState(workspaceRef.current);
  }, [workspaceVersion]);

  return <div className="blockly-workspace" ref={blocklyRef} />;
}
