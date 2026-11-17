import {
  loadPyodide,
  version as pyodideVersion,
  type PyodideInterface,
} from "pyodide";

import spocklyModule from "../python/spockly.py?raw";

type RunRequest = {
  type: "run";
  runId: number;
  code: string;
  /** Files the student picked, by name; written to the working directory first. */
  files?: Record<string, string>;
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
    }
  | {
      /** A "zeige …" block: a table for the app to draw (JSON text from spockly.py). */
      type: "view";
      runId: number;
      kind: string;
      title: string;
      data: string;
      options: string;
    }
  | {
      /** How the data looked after one block (spockly.merke), for clicking on that block. */
      type: "snapshot";
      runId: number;
      block: string;
      data: string;
    }
  | {
      /** A note for the results (spockly.hinweis), e.g. why a table is empty. */
      type: "hint";
      runId: number;
      text: string;
    };

type PythonWorkerScope = {
  onmessage: ((event: MessageEvent<RunRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

const workerScope = self as unknown as PythonWorkerScope;
const pyodideIndexUrl = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;

let pyodidePromise: Promise<PyodideInterface> | null = null;
/** The run the "zeige …" results belong to. */
let currentRunId = 0;

/**
 * Web answers are kept for the session: running the blocks again while building
 * them doesn't ask the same address again (openSenseMap: one request per sensor).
 */
const CACHE_OPEN_URL = `
import io
import pyodide.http as _http

_antworten = {}
_open_url = _http.open_url

def _open_url_gemerkt(url):
    if url not in _antworten:
        _antworten[url] = _open_url(url).read()
    return io.StringIO(_antworten[url])

_http.open_url = _open_url_gemerkt
`;

const setUp = async (pyodide: PyodideInterface) => {
  // spockly.py's "zeige …" functions hand their tables to the app through this module.
  pyodide.registerJsModule("spockly_app", {
    zeige: (kind: string, title: string, data: string, options: string) =>
      workerScope.postMessage({ type: "view", runId: currentRunId, kind, title, data, options }),
    merke: (block: string, data: string) =>
      workerScope.postMessage({ type: "snapshot", runId: currentRunId, block, data }),
    hinweis: (text: string) => workerScope.postMessage({ type: "hint", runId: currentRunId, text }),
  });
  pyodide.FS.writeFile("spockly.py", spocklyModule);
  // spockly.py works with pandas, which every run imports (merke), even when the
  // student's own code doesn't need it yet; loadPackagesFromImports only sees the latter.
  await pyodide.loadPackage("pandas");
  await pyodide.runPythonAsync(CACHE_OPEN_URL);
  return pyodide;
};

const getPyodide = () => {
  pyodidePromise ??= loadPyodide({ indexURL: pyodideIndexUrl }).then(setUp);
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

  const { code, runId, files = {} } = data;
  currentRunId = runId;

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

    for (const [name, text] of Object.entries(files)) {
      pyodide.FS.writeFile(name, text);
    }

    workerScope.postMessage({ type: "status", runId, status: "running" });

    // Without a callback Pyodide prints "pandas already loaded…" into the output,
    // where it looks like something the student's program printed.
    await pyodide.loadPackagesFromImports(code, { messageCallback: () => {} });
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
