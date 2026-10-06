import { useCallback, useEffect, useRef, useState } from "react";

export type PythonRunStatus =
  | "idle"
  | "loading"
  | "running"
  | "success"
  | "error"
  | "stopped";

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
      images: { name: string; dataUrl: string }[];
    }
  | {
      type: "files";
      runId: number;
      files: { name: string; dataUrl: string; mimeType: string }[];
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

export type DataFile = {
  path: string;
  url: string;
};

export type RunOptions = {
  dataFiles?: DataFile[];
  uploadedCsv?: string | null;
};

export type OutputFile = {
  name: string;
  dataUrl: string;
  mimeType: string;
};

export type DataPreview = {
  name: string;
  csvPreview: string;
  rowCount: number;
  columnCount: number;
};

export function usePythonRunner() {
  const workerRef = useRef<Worker | null>(null);
  const activeRunIdRef = useRef(0);
  const [output, setOutput] = useState("");
  const [systemOutput, setSystemOutput] = useState("");
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [dataFiles, setDataFiles] = useState<OutputFile[]>([]);
  const [datasets, setDatasets] = useState<DataPreview[]>([]);
  const [variables, setVariables] = useState<DataPreview[]>([]);
  const [status, setStatus] = useState<PythonRunStatus>("idle");

  const getWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = new Worker(new URL("../workers/python.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.runId !== activeRunIdRef.current) {
        return;
      }

      if (data.type === "status") {
        setStatus(data.status);
        return;
      }

      if (data.type === "output") {
        if (data.stream === "system") {
          setSystemOutput((currentOutput) => currentOutput + data.value);
        } else {
          setOutput((currentOutput) => currentOutput + data.value);
        }
        return;
      }

      if (data.type === "images") {
        setImages(data.images);
        return;
      }

      if (data.type === "files") {
        setDataFiles(data.files);
        return;
      }

      if (data.type === "data") {
        setDatasets(data.datasets);
        setVariables(data.variables);
        return;
      }

      if (data.type === "complete") {
        if (data.result !== undefined) {
          setOutput((currentOutput) => `${currentOutput}${data.result}\n`);
        }
        setStatus("success");
        return;
      }

      setOutput((currentOutput) => `${currentOutput}${data.message}\n`);
      setStatus("error");
    };

    worker.onerror = (event) => {
      if (workerRef.current !== worker) {
        return;
      }

      setOutput((currentOutput) =>
        `${currentOutput}${event.message || "The Python worker stopped unexpectedly."}\n`,
      );
      setStatus("error");
    };

    workerRef.current = worker;
    return worker;
  }, []);

  const run = useCallback(
    (code: string, options?: RunOptions) => {
      const runId = activeRunIdRef.current + 1;
      activeRunIdRef.current = runId;
      setOutput("");
      setSystemOutput("");
      setImages([]);
      setDataFiles([]);
      setDatasets([]);
      setVariables([]);
      setStatus("loading");
      getWorker().postMessage({
        type: "run",
        runId,
        code,
        dataFiles: options?.dataFiles,
        uploadedCsv: options?.uploadedCsv,
      });
    },
    [getWorker],
  );

  const clearOutput = useCallback(() => {
    setOutput("");
    setSystemOutput("");
    setImages([]);
    setDataFiles([]);
    setDatasets([]);
    setVariables([]);
    if (status !== "loading" && status !== "running") {
      setStatus("idle");
    }
  }, [status]);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    activeRunIdRef.current += 1;
    setOutput((currentOutput) =>
      `${currentOutput}${currentOutput ? "\n" : ""}Execution stopped.\n`,
    );
    setStatus("stopped");
  }, []);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return {
    clearOutput,
    dataFiles,
    datasets,
    images,
    isBusy: status === "loading" || status === "running",
    output,
    run,
    status,
    stop,
    systemOutput,
    variables,
  };
}
