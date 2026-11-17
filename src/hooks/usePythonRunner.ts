import { useCallback, useEffect, useRef, useState } from "react";

import { snapshotFrom, viewFrom, type Snapshot, type View } from "../core/fromPython";
import { t } from "../i18n";
import { useAppStore } from "../store/useAppStore";

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
    }
  | {
      type: "view";
      runId: number;
      kind: string;
      title: string;
      data: string;
      options: string;
    }
  | {
      type: "snapshot";
      runId: number;
      block: string;
      data: string;
    }
  | {
      type: "hint";
      runId: number;
      text: string;
    };

export function usePythonRunner() {
  const workerRef = useRef<Worker | null>(null);
  const activeRunIdRef = useRef(0);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<PythonRunStatus>("idle");
  /** What the run's "zeige …" blocks showed, in order. */
  const [views, setViews] = useState<View[]>([]);
  /** The last run's Python error, for explaining it at the block that caused it. */
  const [error, setError] = useState<string | null>(null);
  /**
   * A run's views and snapshots are collected here and shown together when it
   * ends. Until then the last run's stay on screen, so a re-run after a change
   * to the blocks doesn't make the panels go blank for a moment.
   */
  const pendingViews = useRef<View[]>([]);
  const pendingSnapshots = useRef<Record<string, Snapshot>>({});
  /** Notes from the run (spockly.hinweis), shown above the results. */
  const [hints, setHints] = useState<string[]>([]);
  const pendingHints = useRef<string[]>([]);

  const showCollected = useCallback(() => {
    setViews(pendingViews.current);
    setHints(pendingHints.current);
    useAppStore.getState().setSnapshots(pendingSnapshots.current);
  }, []);

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

      if (data.type === "snapshot") {
        pendingSnapshots.current = { ...pendingSnapshots.current, [data.block]: snapshotFrom(data.data) };
        return;
      }

      if (data.type === "hint") {
        pendingHints.current = [...pendingHints.current, data.text];
        return;
      }

      if (data.type === "view") {
        try {
          pendingViews.current = [...pendingViews.current, viewFrom(data)];
        } catch (error) {
          setOutput((currentOutput) => `${currentOutput}${String(error)}
`);
        }
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
        showCollected();
        setStatus("success");
        return;
      }

      setOutput((currentOutput) => `${currentOutput}${data.message}\n`);
      showCollected();
      setError(data.message);
      setStatus("error");
    };

    worker.onerror = (event) => {
      if (workerRef.current !== worker) {
        return;
      }

      // A crashed worker can't run anything; drop it so the next run starts a fresh one.
      worker.terminate();
      workerRef.current = null;
      activeRunIdRef.current += 1;
      showCollected();
      setOutput((currentOutput) =>
        `${currentOutput}${event.message || t("run.crashed")}\n`,
      );
      setStatus("error");
    };

    workerRef.current = worker;
    return worker;
  }, [showCollected]);

  const run = useCallback(
    (code: string, files: Record<string, string> = {}) => {
      const runId = activeRunIdRef.current + 1;
      activeRunIdRef.current = runId;
      setOutput("");
      pendingViews.current = [];
      pendingSnapshots.current = {};
      pendingHints.current = [];
      setError(null);
      setStatus("loading");
      getWorker().postMessage({ type: "run", runId, code, files });
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
    showCollected();
    setOutput((currentOutput) =>
      `${currentOutput}${currentOutput ? "\n" : ""}${t("run.stopped")}\n`,
    );
    setStatus("stopped");
  }, [showCollected]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return {
    clearOutput,
    error,
    hints,
    isBusy: status === "loading" || status === "running",
    output,
    run,
    views,
    status,
    stop,
  };
}
