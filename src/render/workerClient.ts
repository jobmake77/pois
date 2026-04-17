import type { RenderInput, RenderOutput, WorkerRenderInput } from "../types";

let worker: Worker | null = null;
const WORKER_RENDER_TIMEOUT_MS = 30_000;

function getWorker() {
  if (worker) {
    return worker;
  }
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module"
  });
  return worker;
}

export function canUseWorkerExport() {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

export async function exportWithWorker(input: RenderInput): Promise<RenderOutput> {
  const selectedSources = input.sources;
  const payload: WorkerRenderInput = {
    ...input,
    exportType: "image/png",
    sources: await Promise.all(
      selectedSources.map(async (source) => ({
        id: source.id,
        name: source.name,
        buffer: await source.file.arrayBuffer(),
        mimeType: source.file.type || "image/jpeg"
      }))
    )
  };

  return new Promise((resolve, reject) => {
    const currentWorker = getWorker();
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let settled = false;

    const timeout = globalThis.setTimeout(() => {
      fail(new Error("Worker export timed out."));
    }, WORKER_RENDER_TIMEOUT_MS);

    const cleanup = () => {
      currentWorker.removeEventListener("message", onMessage as EventListener);
      currentWorker.removeEventListener("error", onError as EventListener);
      currentWorker.removeEventListener("messageerror", onMessageError as EventListener);
      globalThis.clearTimeout(timeout);
    };

    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      handler();
    };

    const fail = (error: Error) => {
      finish(() => reject(error));
    };

    const onMessage = (
      event: MessageEvent<
        | { id: string; ok: true; result: RenderOutput }
        | { id: string; ok: false; error: string }
      >
    ) => {
      if (event.data.id !== id) {
        return;
      }
      if (event.data.ok) {
        const { result } = event.data;
        finish(() => resolve(result));
        return;
      }
      fail(new Error(event.data.error));
    };

    const onError = (event: ErrorEvent) => {
      fail(new Error(event.message || "Worker export failed."));
    };

    const onMessageError = () => {
      fail(new Error("Worker message decode failed."));
    };

    currentWorker.addEventListener("message", onMessage as EventListener);
    currentWorker.addEventListener("error", onError as EventListener);
    currentWorker.addEventListener("messageerror", onMessageError as EventListener);
    try {
      currentWorker.postMessage({ id, payload });
    } catch (error) {
      fail(error instanceof Error ? error : new Error("Worker postMessage failed."));
    }
  });
}
