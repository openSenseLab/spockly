import { useEffect, useRef } from "react";
import * as Blockly from "blockly";
import * as BlocklyDe from "blockly/msg/de";
import { pythonGenerator } from "blockly/python";
import "blockly/blocks";

import {
  LOAD_HUWISE,
  LOAD_NASA_POWER,
  loadNasaPowerToStep,
  LOAD_OSEM,
  loadHuwiseToStep,
  loadOperations,
  loadOsemToStep,
  pythonBaseNames,
  setPythonNames,
  needsSetup,
  PREDICT,
  type PredictBlock,
  predictToStep,
  refreshPrediction,
  resetPrediction,
  requestBlockSetup,
  setRevealed,
  setTableProvider,
  spocklyTheme,
} from "../blocks";
import { DEFAULT_PYTHON_CODE } from "../constants";
import { toPythonName, uniqueNames } from "../core/names";
import { buildPlan, type StepGenerator } from "../core/plan";
import { lang, t } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import { carriedState, setActiveWorkspace } from "./blockly/carryWorkspace";
import { standardToolbox } from "./blockly/toolbox/toolbox";
import "./blockly/blocks/example";
import "./blockly/blocks/generators/example";

if (lang === "de") {
  Blockly.setLocale(BlocklyDe as unknown as Record<string, string>);
}

const LOAD_WARNING_ID = "load";
const PLAN_WARNING_ID = "plan";
const PREDICT_WARNING_ID = "predict";
/** Fields of load blocks that change which data is loaded (the API blocks use their saved state). */
const LOAD_FIELDS = new Set(["DATASET", "DOMAIN", "MAX_ROWS"]);

/** Blocks below a load block work on the data that block loaded. */
setTableProvider((block) => {
  const load = useAppStore.getState().loads[block.getRootBlock().id];
  return load?.status === "ready" ? load.table : null;
});

const toolbox = {
  ...standardToolbox,
  contents: [
    {
      kind: "category",
      name: t("toolbox.loadData"),
      categorystyle: "load_category",
      contents: [
        { kind: "block", type: LOAD_HUWISE },
        { kind: "block", type: LOAD_OSEM },
        { kind: "block", type: LOAD_NASA_POWER },
      ],
    },
    {
      kind: "category",
      name: t("toolbox.predict"),
      categorystyle: "predict_category",
      contents: [{ kind: "block", type: PREDICT }],
    },
    ...standardToolbox.contents,
  ],
};

/** Block type → plan step. Every SPOCKLY block is listed here. */
const generators: Record<string, StepGenerator> = {
  [LOAD_HUWISE]: (block) => loadHuwiseToStep(block as Blockly.Block),
  [LOAD_OSEM]: (block) => loadOsemToStep(block as Blockly.Block),
  [LOAD_NASA_POWER]: (block) => loadNasaPowerToStep(block as Blockly.Block),
  [PREDICT]: (block) => predictToStep(block as Blockly.Block),
};
const hatTypes = new Set([LOAD_HUWISE, LOAD_OSEM, LOAD_NASA_POWER]);

type BlocklyWorkspaceProps = {
  workspaceVersion: number;
};

const IMPORT_LINE = /^(import|from) \S+/;

/** Several load blocks each bring their imports; list each import once, at the top. */
const hoistImports = (code: string) => {
  const lines = code.split("\n");
  const imports = [...new Set(lines.filter((line) => IMPORT_LINE.test(line)))];
  const body = lines
    .filter((line) => !IMPORT_LINE.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return imports.length ? `${imports.join("\n")}\n\n${body}` : body;
};

const buildPythonPreview = (workspace: Blockly.WorkspaceSvg) => {
  const rawCode = hoistImports(
    pythonGenerator.workspaceToCode(workspace).trim(),
  );

  if (!rawCode) {
    return DEFAULT_PYTHON_CODE;
  }

  return rawCode;
};

/** Compile blocks → plan; put structural warnings on the blocks. */
const compile = (workspace: Blockly.WorkspaceSvg) => {
  const { plan, warnings } = buildPlan({
    topBlocks: workspace.getTopBlocks(true),
    generators,
    hatTypes,
  });

  for (const block of workspace.getAllBlocks(false)) {
    if (!generators[block.type]) continue;
    const text = warnings[block.id]?.map((w) => t(w.code, w.vars)).join("\n");
    block.setWarningText(text || null, PLAN_WARNING_ID);
  }

  const state = useAppStore.getState();
  const loadSteps = plan.strands
    .map((strand) => strand.steps[0])
    .filter((step) => !!step && step.op in loadOperations);
  if (JSON.stringify(loadSteps) !== JSON.stringify(state.loadSteps)) {
    state.setLoadSteps(loadSteps);
  }

  // Columns with an open prediction stay hidden in the Daten tab.
  const hidden: Record<string, string[]> = {};
  for (const strand of plan.strands) {
    const columns = strand.steps
      .filter((step) => step.op === PREDICT && !step.disabled && !step.params.revealed && step.params.column)
      .map((step) => String(step.params.column));
    if (columns.length) hidden[strand.id] = columns;
  }
  if (JSON.stringify(hidden) !== JSON.stringify(state.hiddenColumns)) {
    state.setHiddenColumns(hidden);
  }

  refreshPredictions(workspace);
};

/** Result text, unit and warnings of prediction blocks; depends on the loaded data. */
const refreshPredictions = (workspace: Blockly.WorkspaceSvg) => {
  const { loads, loadSteps } = useAppStore.getState();
  for (const block of workspace.getBlocksByType(PREDICT, false) as PredictBlock[]) {
    const rootId = block.getRootBlock().id;
    const load = loads[rootId];

    // After the data above changed: once data for the new settings is there,
    // a guess about a column that no longer exists starts over.
    const step = loadSteps.find((s) => s.id === rootId);
    const newDataReady = load?.status === "ready" && !!step && load.key === JSON.stringify([step.op, step.params]);
    if (block.awaitingNewData && newDataReady) {
      block.awaitingNewData = false;
      const chosen = String(block.getFieldValue("COLUMN") ?? "");
      if (chosen && !load.table.columns.some((c) => c.name === chosen)) resetPrediction(block);
    }

    refreshPrediction(block);
    const column = String(block.getFieldValue("COLUMN") ?? "");
    let warning: string | null = null;
    if (load?.status === "ready" && block.getRootBlock() !== block) {
      const hasMeasurements = load.table.columns.some(
        (c) => c.dataType === "number" && c.semanticType === "measurement",
      );
      if (!hasMeasurements) warning = t("block.predict.noMeasurements");
      else if (!column) warning = t("block.predict.pickColumn");
      else if (!load.table.columns.some((c) => c.name === column)) warning = t("block.predict.columnMissing");
    }
    block.setWarningText(warning, PREDICT_WARNING_ID);
  }
};

/**
 * Gives every data block its own variable name, so several datasets can be used
 * side by side. Numbered in the order blocks were added, so moving blocks around
 * doesn't swap names.
 */
const assignPythonNames = (workspace: Blockly.WorkspaceSvg) => {
  const blocks = workspace
    .getTopBlocks(false)
    .filter((block) => pythonBaseNames[block.type]);
  const names = uniqueNames(
    blocks.map((block) => toPythonName(pythonBaseNames[block.type](block))),
  );
  const byId = new Map(blocks.map((block, i) => [block.id, names[i]]));
  setPythonNames(byId);
  return Object.fromEntries(byId);
};

/** Python for each strand on its own, so the code tab can follow the selected block. */
const buildStrandCode = (workspace: Blockly.WorkspaceSvg) => {
  const code: Record<string, string> = {};
  for (const top of workspace.getTopBlocks(true)) {
    if (!hatTypes.has(top.type)) continue;
    pythonGenerator.init(workspace);
    const body = pythonGenerator.blockToCode(top);
    code[top.id] = hoistImports(
      pythonGenerator.finish(typeof body === "string" ? body : body[0]).trim(),
    );
  }
  return code;
};

const updateDerivedState = (workspace: Blockly.WorkspaceSvg) => {
  const names = assignPythonNames(workspace);
  useAppStore.getState().setGeneratedCode(buildPythonPreview(workspace));
  useAppStore.getState().setStrandCode(buildStrandCode(workspace), names);
  useAppStore.getState().setWorkspaceMetrics({
    totalBlocks: workspace.getAllBlocks(false).length,
    topLevelBlocks: workspace.getTopBlocks(false).length,
  });
  compile(workspace);
};

/** Load errors become a friendly warning on the block itself. */
const applyLoadWarnings = (workspace: Blockly.WorkspaceSvg) => {
  const { loads } = useAppStore.getState();
  for (const block of workspace.getAllBlocks(false)) {
    if (!hatTypes.has(block.type)) continue;
    const load = loads[block.id];
    block.setWarningText(
      load?.status === "error" ? t(load.errorCode) : null,
      LOAD_WARNING_ID,
    );
  }
};

const resetWorkspaceState = (workspace: Blockly.WorkspaceSvg) => {
  workspace.clear();
  updateDerivedState(workspace);
};

export function BlocklyWorkspace({ workspaceVersion }: BlocklyWorkspaceProps) {
  const blocklyRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

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
        startScale: 0.95,
        maxScale: 1.5,
        minScale: 0.4,
        scaleSpeed: 1.1,
      },
    });

    const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
      // A fresh block with a setup window (API loaders) opens it once it is dropped
      // (not on create: blocks from the toolbox are created when the drag starts).
      if (event.type === Blockly.Events.BLOCK_DRAG) {
        const drag = event as Blockly.Events.BlockDrag;
        const block = drag.blockId
          ? workspace.getBlockById(drag.blockId)
          : null;
        if (!drag.isStart && needsSetup(block)) {
          requestBlockSetup(block.id);
        }
      }

      if (event.type === Blockly.Events.SELECTED) {
        const { newElementId } = event as Blockly.Events.Selected;
        const block = newElementId
          ? workspace.getBlockById(newElementId)
          : null;
        useAppStore
          .getState()
          .setSelectedBlockId(block?.getRootBlock().id ?? null);
        return;
      }

      if (event.isUiEvent) {
        return;
      }

      // Asking about another value or column is a new question: hide the answer again.
      if (event.type === Blockly.Events.BLOCK_CHANGE) {
        const change = event as Blockly.Events.BlockChange;
        const block = change.blockId ? workspace.getBlockById(change.blockId) : null;
        if (
          block?.type === PREDICT &&
          change.element === "field" &&
          (change.name === "QUANTITY" || change.name === "COLUMN")
        ) {
          setRevealed(block as unknown as PredictBlock, false);
        }

        // New data above a guess is a new question too: hide the answer, and
        // check the guessed column once the new data has arrived.
        const settingsChanged =
          change.element === "mutation" ||
          (change.element === "field" && LOAD_FIELDS.has(change.name ?? ""));
        if (block && hatTypes.has(block.type) && settingsChanged) {
          for (const below of block.getDescendants(false)) {
            if (below.type !== PREDICT) continue;
            const guess = below as unknown as PredictBlock;
            guess.awaitingNewData = true;
            setRevealed(guess, false);
          }
        }
      }

      updateDerivedState(workspace);
    };

    const onResize = () => Blockly.svgResize(workspace);
    const unsubscribeLoads = useAppStore.subscribe((state, previous) => {
      if (state.loads !== previous.loads) {
        applyLoadWarnings(workspace);
        refreshPredictions(workspace);
      }
    });

    workspace.addChangeListener(onWorkspaceChange);
    workspaceRef.current = workspace;
    setActiveWorkspace(workspace);
    window.addEventListener("resize", onResize);
    onResize();

    if (carriedState) {
      try {
        Blockly.serialization.workspaces.load(carriedState, workspace);
      } catch (error) {
        console.error("[workspace] could not restore blocks", error);
      }
    }

    return () => {
      unsubscribeLoads();
      window.removeEventListener("resize", onResize);
      workspace.removeChangeListener(onWorkspaceChange);
      workspace.dispose();
      workspaceRef.current = null;
      setActiveWorkspace(null);
    };
  }, []);

  useEffect(() => {
    // Version 0 is the initial mount: nothing to reset, and clearing here
    // would throw away blocks restored after a language switch.
    if (!workspaceRef.current || workspaceVersion === 0) {
      return;
    }

    resetWorkspaceState(workspaceRef.current);
  }, [workspaceVersion]);

  return <div className="blockly-workspace" ref={blocklyRef} />;
}
