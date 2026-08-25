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

export function usePythonRunner() {
  const workerRef = useRef<Worker | null>(null);
  const activeRunIdRef = useRef(0);
  const [output, setOutput] = useState("");
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
        setOutput((currentOutput) => currentOutput + data.value);
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
    (code: string) => {
      const runId = activeRunIdRef.current + 1;
      activeRunIdRef.current = runId;
      setOutput("");
      setStatus("loading");
      getWorker().postMessage({ type: "run", runId, code });
    },
    [getWorker],
  );

  const clearOutput = useCallback(() => {
    setOutput("");
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
    isBusy: status === "loading" || status === "running",
    output,
    run,
    status,
    stop,
  };
}
