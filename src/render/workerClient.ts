import type { RenderInput, RenderOutput, WorkerRenderInput } from "../types";

let worker: Worker | null = null;

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
    exportType: input.project.exportFormat === "jpeg" ? "image/jpeg" : "image/png",
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
    const onMessage = (
      event: MessageEvent<
        | { id: string; ok: true; result: RenderOutput }
        | { id: string; ok: false; error: string }
      >
    ) => {
      if (event.data.id !== id) {
        return;
      }
      currentWorker.removeEventListener("message", onMessage as EventListener);
      if (event.data.ok) {
        resolve(event.data.result);
        return;
      }
      reject(new Error(event.data.error));
    };
    currentWorker.addEventListener("message", onMessage as EventListener);
    currentWorker.postMessage({ id, payload });
  });
}
