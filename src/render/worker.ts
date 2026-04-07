import type { RenderOutput, WorkerRenderInput } from "../types";
import { renderToOffscreenBlob } from "./engine";

self.onmessage = async (
  event: MessageEvent<{ id: string; payload: WorkerRenderInput }>
) => {
  const { id, payload } = event.data;

  try {
    const sources = await Promise.all(
      payload.sources.map(async (source) => {
        const blob = new Blob([source.buffer], { type: source.mimeType });
        const bitmap = await createImageBitmap(blob);
        return {
          id: source.id,
          name: source.name,
          width: bitmap.width,
          height: bitmap.height,
          aspectRatio: bitmap.width / bitmap.height,
          dominantColor: "#999999",
          objectUrl: "",
          file: new File([blob], source.name, { type: source.mimeType }),
          image: bitmap
        };
      })
    );

    const result = await renderToOffscreenBlob({
      ...payload,
      sources
    }, payload.exportType);

    self.postMessage({
      id,
      ok: true,
      result
    } satisfies { id: string; ok: true; result: RenderOutput });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown worker render error."
    });
  }
};

export {};
