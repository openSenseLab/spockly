import {
  loadPyodide,
  version as pyodideVersion,
  type PyodideInterface,
} from "pyodide";

type RunRequest = {
  type: "run";
  runId: number;
  code: string;
};

type WorkerResponse =
  | {
      type: "status";
      runId: number;
      status: "loading" | "running";
    }
  | {
      type: "output";
      runId: number;
      stream: "stdout" | "stderr";
      value: string;
    }
  | {
      type: "complete";
      runId: number;
      result?: string;
    }
  | {
      type: "error";
      runId: number;
      message: string;
    };

type PythonWorkerScope = {
  onmessage: ((event: MessageEvent<RunRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

const workerScope = self as unknown as PythonWorkerScope;
const pyodideIndexUrl = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;

let pyodidePromise: Promise<PyodideInterface> | null = null;

const getPyodide = () => {
  pyodidePromise ??= loadPyodide({ indexURL: pyodideIndexUrl });
  return pyodidePromise;
};

const formatResult = (result: unknown) => {
  if (result === undefined || result === null) {
    return undefined;
  }

  try {
    return String(result);
  } finally {
    if (
      typeof result === "object" &&
      "destroy" in result &&
      typeof result.destroy === "function"
    ) {
      result.destroy();
    }
  }
};

workerScope.onmessage = async ({ data }) => {
  if (data.type !== "run") {
    return;
  }

  const { code, runId } = data;

  workerScope.postMessage({ type: "status", runId, status: "loading" });

  try {
    const pyodide = await getPyodide();

    pyodide.setStdout({
      batched: (value) =>
        workerScope.postMessage({
          type: "output",
          runId,
          stream: "stdout",
          value: `${value}\n`,
        }),
    });
    pyodide.setStderr({
      batched: (value) =>
        workerScope.postMessage({
          type: "output",
          runId,
          stream: "stderr",
          value: `${value}\n`,
        }),
    });

    workerScope.postMessage({ type: "status", runId, status: "running" });

    await pyodide.loadPackagesFromImports(code);
    const result = formatResult(
      await pyodide.runPythonAsync(code, { filename: "blockly_program.py" }),
    );

    workerScope.postMessage({ type: "complete", runId, result });
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      runId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
