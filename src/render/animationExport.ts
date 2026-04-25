import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeVideo
} from "mediabunny";
import type { RenderInput, RenderOutput } from "../types";
import { renderToCanvas } from "./engine";
import { createAnimationProject, getAnimationDotCount } from "./dotAnimation";

const DEFAULT_FPS = 24;
const FINAL_HOLD_FRAMES = 18;
const MP4_CODEC_CANDIDATES = ["avc", "hevc", "av1"] as const;

export async function exportDotAnimation(input: RenderInput): Promise<RenderOutput> {
  if (
    typeof document === "undefined" ||
    typeof HTMLCanvasElement === "undefined" ||
    typeof VideoEncoder === "undefined"
  ) {
    throw new Error("Animation export is unavailable in this browser.");
  }

  const totalDots = getAnimationDotCount(input.project);
  if (totalDots <= 0) {
    throw new Error("No dots available for animation export.");
  }

  const codec = await getSupportedMp4Codec();
  if (!codec) {
    throw new Error("This browser does not support MP4 animation export.");
  }

  const canvas = document.createElement("canvas");
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target
  });
  const source = new CanvasSource(canvas, {
    codec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 1,
    latencyMode: "quality"
  });
  const totalFrames = totalDots + 1 + FINAL_HOLD_FRAMES;
  const startedAt = performance.now();

  output.addVideoTrack(source, {
    frameRate: DEFAULT_FPS,
    maximumPacketCount: totalFrames
  });

  await output.start();

  await renderAnimationFrame(canvas, input, 0);
  await source.add(0, 1 / DEFAULT_FPS);

  let frameIndex = 1;
  for (let visibleDotCount = 1; visibleDotCount <= totalDots; visibleDotCount += 1) {
    await renderAnimationFrame(canvas, input, visibleDotCount);
    await source.add(frameIndex / DEFAULT_FPS, 1 / DEFAULT_FPS);
    frameIndex += 1;
  }

  for (let holdFrame = 0; holdFrame < FINAL_HOLD_FRAMES; holdFrame += 1) {
    await source.add(frameIndex / DEFAULT_FPS, 1 / DEFAULT_FPS);
    frameIndex += 1;
  }

  await output.finalize();

  if (!target.buffer) {
    throw new Error("MP4 export did not produce any data.");
  }

  return {
    blob: new Blob([target.buffer], { type: "video/mp4" }),
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

async function getSupportedMp4Codec() {
  for (const codec of MP4_CODEC_CANDIDATES) {
    if (await canEncodeVideo(codec, { width: 1280, height: 720, bitrate: 5_000_000 })) {
      return codec;
    }
  }

  return null;
}
