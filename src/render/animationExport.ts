import type { RenderInput, RenderOutput } from "../types";
import { renderToCanvas } from "./engine";
import { createAnimationProject, getAnimationDotCount } from "./dotAnimation";

const DEFAULT_FPS = 24;

export async function exportDotAnimation(input: RenderInput): Promise<RenderOutput> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("Animation export is unavailable in this browser.");
  }

  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    throw new Error("This browser does not support WebM recording.");
  }

  const totalDots = getAnimationDotCount(input.project);
  if (totalDots <= 0) {
    throw new Error("No dots available for animation export.");
  }

  const canvas = document.createElement("canvas");
  const stream = canvas.captureStream(DEFAULT_FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5_000_000
  });
  const chunks: BlobPart[] = [];
  const startedAt = performance.now();

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Animation recording failed."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();

  await renderAnimationFrame(canvas, input, 0);
  await waitForFrame(DEFAULT_FPS);

  for (let visibleDotCount = 1; visibleDotCount <= totalDots; visibleDotCount += 1) {
    await renderAnimationFrame(canvas, input, visibleDotCount);
    requestAnimationFrameOnTrack(stream);
    await waitForFrame(DEFAULT_FPS);
  }

  await waitForFrame(DEFAULT_FPS, 18);
  recorder.stop();
  stopStream(stream);

  const blob = await stopped;
  return {
    blob,
    width: input.project.canvasWidth,
    height: input.project.canvasHeight,
    durationMs: performance.now() - startedAt
  };
}

async function renderAnimationFrame(
  canvas: HTMLCanvasElement,
  input: RenderInput,
  visibleDotCount: number
) {
  const project = createAnimationProject(input.project, visibleDotCount);
  await renderToCanvas(canvas, {
    ...input,
    project,
    width: project.canvasWidth,
    height: project.canvasHeight,
    pixelRatio: 1
  });
}

function getSupportedMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

function requestAnimationFrameOnTrack(stream: MediaStream) {
  const [track] = stream.getVideoTracks();
  const candidate = track as MediaStreamTrack & { requestFrame?: () => void };
  candidate.requestFrame?.();
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function waitForFrame(fps: number, frameCount = 1) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, (1000 / fps) * frameCount);
  });
}
