import {
  loadPyodide,
  version as pyodideVersion,
  type PyodideInterface,
} from "pyodide";
import type { PyProxy } from "pyodide/ffi";

type DataFile = {
  /** Path inside the Pyodide virtual filesystem, e.g. "/data/muenster_measurements_72h.csv" */
  path: string;
  /** URL to fetch the file content from (same-origin, e.g. "/data/...") */
  url: string;
};

type RunRequest = {
  type: "run";
  runId: number;
  code: string;
  /** Data files to fetch and write into the Pyodide FS before running. */
  dataFiles?: DataFile[];
  /** Optional uploaded CSV content, written to "/data/uploaded.csv". */
  uploadedCsv?: string | null;
};

type OutputImage = {
  name: string;
  dataUrl: string;
};

type OutputFile = {
  name: string;
  dataUrl: string;
  mimeType: string;
};

type DataPreview = {
  name: string;
  csvPreview: string;
  /** Total number of rows in the underlying DataFrame. */
  rowCount: number;
  /** Total number of columns in the underlying DataFrame. */
  columnCount: number;
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
      stream: "stdout" | "stderr" | "system";
      value: string;
    }
  | {
      type: "images";
      runId: number;
      images: OutputImage[];
    }
  | {
      type: "files";
      runId: number;
      files: OutputFile[];
    }
  | {
      type: "data";
      runId: number;
      datasets: DataPreview[];
      variables: DataPreview[];
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

/** Convert a Uint8Array to a base64 data URL without blowing the call stack. */
const toBase64DataUrl = (bytes: Uint8Array, mime: string): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
};

/** Read all PNG files from the Pyodide "/output" directory as data URLs. */
const readOutputImages = (pyodide: PyodideInterface): OutputImage[] => {
  const images: OutputImage[] = [];
  try {
    const files = pyodide.FS.readdir("/output");
    for (const file of files) {
      if (file === "." || file === "..") {
        continue;
      }
      if (file.endsWith(".png")) {
        const data = pyodide.FS.readFile(`/output/${file}`);
        images.push({
          name: file,
          dataUrl: toBase64DataUrl(new Uint8Array(data), "image/png"),
        });
      }
    }
  } catch {
    // No /output directory exists yet — nothing to read.
  }
  return images;
};

/** Read all CSV/JSON/GeoJSON files from the Pyodide "/output" directory as data URLs. */
const readOutputDataFiles = (pyodide: PyodideInterface): OutputFile[] => {
  const files: OutputFile[] = [];
  try {
    const entries = pyodide.FS.readdir("/output");
    for (const file of entries) {
      if (file === "." || file === "..") {
        continue;
      }
      const lower = file.toLowerCase();
      let mimeType: string | null = null;
      if (lower.endsWith(".csv")) {
        mimeType = "text/csv";
      } else if (lower.endsWith(".json")) {
        mimeType = "application/json";
      } else if (lower.endsWith(".geojson")) {
        mimeType = "application/geo+json";
      }
      if (!mimeType) {
        continue;
      }
      const data = pyodide.FS.readFile(`/output/${file}`);
      files.push({
        name: file,
        dataUrl: toBase64DataUrl(new Uint8Array(data), mimeType),
        mimeType,
      });
    }
  } catch {
    // No /output directory exists yet — nothing to read.
  }
  return files;
};

/**
 * Capture a head() preview of every DataFrame variable in scope, plus a preview
 * of each input dataset file. Runs after the script so it reflects how far the
 * script got — variables assigned before an error are captured, later ones are not.
 *
 * The preview is captured from the run's own namespace (not the shared Pyodide
 * globals), so variables from earlier runs cannot leak into the current run.
 */
const captureDataPreviews = (
  pyodide: PyodideInterface,
  inputPaths: string[],
  namespace: PyProxy,
): { datasets: DataPreview[]; variables: DataPreview[] } => {
  try {
    namespace.set("__spockly_input_paths__", inputPaths);
    const json = pyodide.runPython(
      `
import pandas as pd, json, csv, io
__spockly_data__ = {"datasets": {}, "variables": {}}

def __spockly_preview__(df):
    """Return a structured preview: row/col counts plus a CSV of the first rows."""
    try:
        head = df.head(100)
        csv_text = head.to_csv(index=False)
    except Exception:
        csv_text = ""
    return {
        "rowCount": int(len(df)),
        "columnCount": int(len(df.columns)),
        "csvPreview": csv_text,
    }

for __name__, __val in list(globals().items()):
    if __name__.startswith("__spockly_"):
        continue
    if isinstance(__val, pd.DataFrame):
        try:
            __spockly_data__["variables"][__name__] = __spockly_preview__(__val)
        except Exception:
            pass
for __path__ in __spockly_input_paths__:
    try:
        __df__ = pd.read_csv(__path__)
        __spockly_data__["datasets"][__path__] = __spockly_preview__(__df__)
    except Exception:
        try:
            with open(__path__) as __f__:
                __spockly_data__["datasets"][__path__] = {
                    "rowCount": 0,
                    "columnCount": 0,
                    "csvPreview": __f__.read()[:5000],
                }
        except Exception:
            pass
try:
  del __df__
except NameError:
  pass
json.dumps(__spockly_data__)
`,
      { globals: namespace },
    );
    const parsed = JSON.parse(json);
    const datasets = Object.entries(parsed.datasets || {}).map(([path, preview]) => ({
      name: path.split("/").pop() || path,
      csvPreview: (preview as { csvPreview: string }).csvPreview,
      rowCount: (preview as { rowCount: number }).rowCount,
      columnCount: (preview as { columnCount: number }).columnCount,
    }));
    const variables = Object.entries(parsed.variables || {}).map(([name, preview]) => ({
      name,
      csvPreview: (preview as { csvPreview: string }).csvPreview,
      rowCount: (preview as { rowCount: number }).rowCount,
      columnCount: (preview as { columnCount: number }).columnCount,
    }));
    return { datasets, variables };
  } catch {
    return { datasets: [], variables: [] };
  }
};

/** Remove all files from the Pyodide "/output" directory before a run. */
const clearOutputDirectory = (pyodide: PyodideInterface): void => {
  try {
    const entries = pyodide.FS.readdir("/output");
    for (const file of entries) {
      if (file === "." || file === "..") {
        continue;
      }
      try {
        pyodide.FS.unlink(`/output/${file}`);
      } catch {
        // Ignore files that cannot be removed (e.g. directories).
      }
    }
  } catch {
    // No /output directory exists yet — nothing to clear.
  }
};

/** Remove a stale uploaded CSV (if any) so a run without an upload starts clean. */
const removeStaleUpload = (pyodide: PyodideInterface): void => {
  try {
    pyodide.FS.unlink("/data/uploaded.csv");
  } catch {
    // No uploaded file exists — nothing to remove.
  }
};

/** Fetch a data file and write it into the Pyodide virtual filesystem. */
const writeDataFile = async (
  pyodide: PyodideInterface,
  file: DataFile,
): Promise<void> => {
  const response = await fetch(file.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch data file: ${file.url} (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  const dir = file.path.substring(0, file.path.lastIndexOf("/")) || "/";
  pyodide.FS.mkdirTree(dir);
  pyodide.FS.writeFile(file.path, new Uint8Array(buffer));
};

workerScope.onmessage = async ({ data }) => {
  if (data.type !== "run") {
    return;
  }

  const { code, runId, dataFiles, uploadedCsv } = data;
  let phase: "loading" | "running" = "loading";

  workerScope.postMessage({ type: "status", runId, status: "loading" });

  try {
    const pyodide = await getPyodide();

    // Ensure the /data and /output directories exist.
    pyodide.FS.mkdirTree("/data");
    pyodide.FS.mkdirTree("/output");

    // Clear any outputs from a previous run so a removed plot-producing step
    // no longer shows a stale result.
    clearOutputDirectory(pyodide);

    // Remove a stale uploaded CSV when no upload is supplied for this run.
    removeStaleUpload(pyodide);

    // Write any requested data files into the virtual filesystem.
    if (dataFiles && dataFiles.length > 0) {
      for (const file of dataFiles) {
        await writeDataFile(pyodide, file);
      }
    }

    // Write an uploaded CSV (if any) to a well-known path.
    if (uploadedCsv) {
      pyodide.FS.writeFile("/data/uploaded.csv", uploadedCsv);
    }

    // Create a fresh user namespace for this run so variables from earlier runs
    // cannot satisfy missing current-run steps.
    const namespace = pyodide.toPy({});

    pyodide.setStdout({
      batched: (value) =>
        workerScope.postMessage({
          type: "output",
          runId,
          stream: phase === "loading" ? "system" : "stdout",
          value: `${value}\n`,
        }),
    });
    pyodide.setStderr({
      batched: (value) =>
        workerScope.postMessage({
          type: "output",
          runId,
          stream: phase === "loading" ? "system" : "stderr",
          value: `${value}\n`,
        }),
    });

    workerScope.postMessage({ type: "status", runId, status: "running" });

    let result: string | undefined;
    let error: string | undefined;
    try {
      await pyodide.loadPackagesFromImports(code);
      phase = "running";
      result = formatResult(
        await pyodide.runPythonAsync(code, {
          globals: namespace,
          filename: "blockly_program.py",
        }),
      );
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    // Collect outputs regardless of whether the script succeeded or errored.
    const images = readOutputImages(pyodide);
    const files = readOutputDataFiles(pyodide);
    const inputPaths = [
      ...(dataFiles?.map((f) => f.path) ?? []),
      ...(uploadedCsv ? ["/data/uploaded.csv"] : []),
    ];
    const { datasets, variables } = captureDataPreviews(
      pyodide,
      inputPaths,
      namespace,
    );

    if (images.length > 0) {
      workerScope.postMessage({ type: "images", runId, images });
    }
    if (files.length > 0) {
      workerScope.postMessage({ type: "files", runId, files });
    }
    if (datasets.length > 0 || variables.length > 0) {
      workerScope.postMessage({ type: "data", runId, datasets, variables });
    }

    if (error) {
      workerScope.postMessage({ type: "error", runId, message: error });
    } else {
      workerScope.postMessage({ type: "complete", runId, result });
    }

    // Release the run namespace now that all previews have been captured.
    namespace.destroy();
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      runId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
