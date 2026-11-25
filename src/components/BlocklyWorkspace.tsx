import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import * as BlocklyDe from "blockly/msg/de";
import "blockly/blocks";

import {
  followRename,
  generate,
  adviceFor,
  markAdvice,
  markFailure,
  markRunState,
  misfitAfterDrop,
  narrowKinds,
  ranAsItIs,
  refreshFieldLabels,
  spocklyTheme,
  toolbox,
} from "../blocks";
import { DEFAULT_PYTHON_CODE } from "../constants";
import { lang, t } from "../i18n";
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


/**
 * Marks the blocks the last run didn't cover (new or changed since, or after a
 * failed block), and the block it failed at.
 */
const markRun = (workspace: Blockly.WorkspaceSvg) => {
  const { lastRun, snapshots, filesVersion, failure } = useAppStore.getState();
  markRunState(workspace, lastRun?.signatures ?? null, snapshots, filesVersion);
  // A new error: to the block. Its explanation opens on a click on its warning sign, or on hovering
  // (opened by itself, the bubble would cover the blocks above).
  const failed = markFailure(
    workspace,
    failure,
    lastRun?.signatures ?? null,
    filesVersion,
  );
  if (failed) workspace.centerOnBlock(failed.id);
  // Advice on a block whose result the run left as it is (e.g. a table of one row from GeoJSON):
  // drawn amber, with the advice on hover and in its warning.
  const advice = new Map<string, string>();
  for (const block of workspace.getAllBlocks(false)) {
    const current =
      lastRun !== null &&
      ranAsItIs(block, lastRun.signatures, snapshots, filesVersion);
    const text = current ? adviceFor(block, snapshots) : null;
    if (text) advice.set(block.id, text);
  }
  markAdvice(workspace, advice);
};

const resetWorkspaceState = (workspace: Blockly.WorkspaceSvg) => {
  workspace.clear();
  updateDerivedState(workspace);
};

export function BlocklyWorkspace({ workspaceVersion }: BlocklyWorkspaceProps) {
  const blocklyRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const firstVersion = useRef(workspaceVersion);
  /** Why the last dropped blocks didn't snap to the block next to them (see blocks/fit). */
  const [misfit, setMisfit] = useState<string | null>(null);

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

    let hideMisfit: ReturnType<typeof setTimeout> | undefined;
    const showMisfit = (text: string | null) => {
      clearTimeout(hideMisfit);
      setMisfit(text);
      // Long enough to read, then out of the way.
      if (text) hideMisfit = setTimeout(() => setMisfit(null), 9000);
    };

    const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
      // A drop next to a block it can't go with: say why (Blockly only refuses to snap).
      if (event.type === Blockly.Events.BLOCK_DRAG) {
        const drag = event as Blockly.Events.BlockDrag;
        const block = drag.blockId
          ? workspace.getBlockById(drag.blockId)
          : null;
        if (drag.isStart || !block) {
          showMisfit(null);
          return;
        }
        // After Blockly has drawn the dropped blocks where they are now (their connections
        // move with the drawing), and before it bumps them away from blocks they don't fit.
        void Blockly.renderManagement
          .finishQueuedRenders()
          .then(() =>
            showMisfit(block.isDisposed() ? null : misfitAfterDrop(block)),
          );
        return;
      }
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
      // E.g. "übersetze den JSON-Text" moved from openSenseMap to a file: the stations table no longer fits under it.
      narrowKinds(workspace);
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
      if (
        state.snapshots !== before.snapshots ||
        state.lastRun !== before.lastRun ||
        state.filesVersion !== before.filesVersion ||
        state.failure !== before.failure
      )
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
      clearTimeout(hideMisfit);
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

  return (
    <div className="blockly-frame">
      <div className="blockly-workspace" ref={blocklyRef} />
      {misfit && (
        <div className="blockly-misfit" role="status">
          <span>{misfit}</span>
          <button
            type="button"
            aria-label={t("fit.close")}
            onClick={() => setMisfit(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
