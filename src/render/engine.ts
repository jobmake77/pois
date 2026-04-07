import type {
  BaseStyle,
  Distribution,
  FillMode,
  RenderInput,
  SourceAsset
} from "../types";
import { clamp, lerp, mulberry32 } from "./random";
import { createShapePath } from "./shapes";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface DistributionOptions {
  minDistance: number;
  overflowTop?: number;
  overflowBottom?: number;
  verticalBias?: "top" | "bottom" | "center";
}

interface Sampler {
  image: CanvasImageSource;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

interface CanvasSource {
  id: string;
  name: string;
  width: number;
  height: number;
  image: CanvasImageSource;
}

export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  input: RenderInput
) {
  const { width, height, pixelRatio } = input;
  const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(height * pixelRatio));
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  await drawPoster(context, {
    ...input,
    width: targetWidth,
    height: targetHeight,
    pixelRatio: 1
  });
}

export async function renderToOffscreenBlob(
  input: RenderInput,
  type = "image/png"
) {
  const width = Math.max(1, Math.floor(input.width * input.pixelRatio));
  const height = Math.max(1, Math.floor(input.height * input.pixelRatio));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("OffscreenCanvas 2D context is unavailable.");
  }
  const start = performance.now();
  await drawPoster(context, {
    ...input,
    width,
    height,
    pixelRatio: 1
  });
  const blob = await canvas.convertToBlob({
    type,
    quality: input.exportQuality ?? 0.96
  });
  return {
    blob,
    width,
    height,
    durationMs: performance.now() - start
  };
}

export async function renderToBlobOnMain(
  input: RenderInput,
  type = "image/png"
) {
  const width = Math.max(1, Math.floor(input.width * input.pixelRatio));
  const height = Math.max(1, Math.floor(input.height * input.pixelRatio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  const start = performance.now();
  await drawPoster(context, {
    ...input,
    width,
    height,
    pixelRatio: 1
  });
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("Canvas export failed."));
      },
      type,
      input.exportQuality ?? 0.96
    );
  });
  return {
    blob,
    width,
    height,
    durationMs: performance.now() - start
  };
}

export async function drawPoster(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput
) {
  const sources = normalizeSources(input.sources);
  const theme = input.theme;
  const { width, height } = input;
  const layout = input.project.layout;
  const base = input.project.base;
  const dots = input.project.dots;
  const rng = mulberry32(dots.seed);
  const samplers = createSamplers(sources);

  const contentRect: Rect = {
    x: layout.padding,
    y: layout.padding,
    width: width - layout.padding * 2,
    height: height - layout.padding * 2
  };
  const topRect: Rect = {
    x: contentRect.x,
    y: contentRect.y,
    width: contentRect.width,
    height: contentRect.height * layout.splitRatio
  };
  const bottomRect: Rect = {
    x: contentRect.x,
    y: topRect.y + topRect.height,
    width: contentRect.width,
    height: contentRect.height - topRect.height
  };

  context.save();
  context.clearRect(0, 0, width, height);
  context.fillStyle = theme.palette.surface;
  context.fillRect(0, 0, width, height);
  context.restore();

  drawTopRegion(context, sources, topRect, layout.cropX, layout.cropY, layout.compositionMode);
  drawBaseRegion(context, bottomRect, base.style, base.primaryColor, base.secondaryColor, base.stripeThickness);
  const topShare =
    layout.compositionMode === "single" && layout.splitRatio >= 0.54
      ? Math.max(dots.topShare, 0.6)
      : dots.topShare;
  const topCount = Math.round(dots.dotCount * topShare);
  const bottomCount = Math.max(0, dots.dotCount - topCount);

  const topPoints = createDistribution(
    dots.topDistribution,
    topCount,
    topRect,
    rng,
    {
      minDistance: Math.max(10, dots.dotSize * 0.72),
      overflowTop: topRect.height * 0.08,
      overflowBottom: topRect.height * 0.04,
      verticalBias: "top"
    }
  );
  const bottomPoints = createDistribution(
    dots.bottomDistribution,
    bottomCount,
    bottomRect,
    rng,
    {
      minDistance: Math.max(12, dots.dotSize * 1.05),
      verticalBias: dots.bottomDistribution === "bottom-heavy" ? "bottom" : "center"
    }
  );

  drawSampleDots(context, input, sources, samplers, topRect, topPoints, rng, theme.palette.accent);
  drawSampleDots(context, input, sources, samplers, bottomRect, bottomPoints, rng, theme.palette.accent);
  drawDecorativeDots(context, input, topRect, bottomRect, rng, theme.palette);
}

function normalizeSources(sources: SourceAsset[]): CanvasSource[] {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    width: source.width,
    height: source.height,
    image: source.image
  }));
}

function createSamplers(sources: CanvasSource[]): Map<string, Sampler> {
  const map = new Map<string, Sampler>();
  for (const source of sources) {
    const size = 64;
    const useOffscreen = typeof OffscreenCanvas !== "undefined";
    const canvas = useOffscreen
      ? new OffscreenCanvas(size, size)
      : document.createElement("canvas");
    if (!useOffscreen) {
      (canvas as HTMLCanvasElement).width = size;
      (canvas as HTMLCanvasElement).height = size;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }
    context.drawImage(source.image, 0, 0, size, size);
    map.set(source.id, {
      image: source.image,
      canvas,
      context
    });
  }
  return map;
}

function drawTopRegion(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sources: CanvasSource[],
  rect: Rect,
  cropX: number,
  cropY: number,
  mode: "single" | "duo" | "triptych"
) {
  if (mode === "single") {
    const source = sources[0];
    if (!source) {
      return;
    }
    drawCroppedImage(context, source.image, source.width, source.height, rect, cropX, cropY);
    return;
  }

  if (mode === "duo") {
    const [left, right] = [sources[0], sources[1] ?? sources[0]];
    const gap = Math.max(6, rect.width * 0.012);
    const leftWidth = rect.width * 0.62;
    const rightWidth = rect.width - leftWidth - gap;
    if (left) {
      drawCroppedImage(
        context,
        left.image,
        left.width,
        left.height,
        { x: rect.x, y: rect.y, width: leftWidth, height: rect.height },
        cropX,
        cropY
      );
    }
    if (right) {
      const upperHeight = rect.height * 0.58;
      drawCroppedImage(
        context,
        right.image,
        right.width,
        right.height,
        {
          x: rect.x + leftWidth + gap,
          y: rect.y,
          width: rightWidth,
          height: upperHeight
        },
        cropX * 0.8,
        cropY * 0.8
      );
      drawCroppedImage(
        context,
        left.image,
        left.width,
        left.height,
        {
          x: rect.x + leftWidth + gap,
          y: rect.y + upperHeight + gap,
          width: rightWidth,
          height: rect.height - upperHeight - gap
        },
        -cropX * 0.6,
        cropY * 0.4
      );
    }
    return;
  }

  const gap = Math.max(4, rect.width * 0.01);
  const columnWidth = (rect.width - gap * 2) / 3;
  for (let index = 0; index < 3; index += 1) {
    const source = sources[index % sources.length];
    if (!source) {
      continue;
    }
    drawCroppedImage(
      context,
      source.image,
      source.width,
      source.height,
      {
        x: rect.x + index * (columnWidth + gap),
        y: rect.y,
        width: columnWidth,
        height: rect.height
      },
      cropX * (index === 1 ? 1 : 0.7),
      cropY
    );
  }
}

function drawCroppedImage(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  rect: Rect,
  cropX: number,
  cropY: number
) {
  const targetRatio = rect.width / rect.height;
  const sourceRatio = naturalWidth / naturalHeight;
  let sx = 0;
  let sy = 0;
  let sw = naturalWidth;
  let sh = naturalHeight;
  if (sourceRatio > targetRatio) {
    sw = naturalHeight * targetRatio;
    sx = ((naturalWidth - sw) / 2) * (cropX + 1);
    sx = clamp(sx, 0, naturalWidth - sw);
  } else {
    sh = naturalWidth / targetRatio;
    sy = ((naturalHeight - sh) / 2) * (cropY + 1);
    sy = clamp(sy, 0, naturalHeight - sh);
  }
  context.drawImage(image, sx, sy, sw, sh, rect.x, rect.y, rect.width, rect.height);
}

function drawBaseRegion(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: Rect,
  style: BaseStyle,
  primary: string,
  secondary: string,
  stripeThickness: number
) {
  context.save();
  if (style === "solid") {
    context.fillStyle = primary;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.restore();
    return;
  }

  if (style === "pixel") {
    context.fillStyle = secondary;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    const block = Math.max(8, stripeThickness);
    for (let y = 0; y < rect.height; y += block) {
      for (let x = 0; x < rect.width; x += block) {
        const even = (x / block + y / block) % 2 === 0;
        context.fillStyle = even ? primary : secondary;
        context.fillRect(rect.x + x, rect.y + y, block, block);
      }
    }
    context.restore();
    return;
  }

  context.fillStyle = secondary;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  const stripeGap = style === "duotone" ? stripeThickness * 1.8 : stripeThickness * 2;
  for (let y = rect.y; y < rect.y + rect.height; y += stripeGap) {
    context.fillStyle = primary;
    context.fillRect(rect.x, y, rect.width, stripeThickness);
  }
  context.restore();
}

function drawSampleDots(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  sources: CanvasSource[],
  samplers: Map<string, Sampler>,
  rect: Rect,
  points: Point[],
  rng: () => number,
  accent: string
) {
  const { dots } = input.project;
  points.forEach((point, index) => {
    const size = dots.dotSize + (rng() - 0.5) * dots.sizeVariance;
    const source = sources[index % sources.length] ?? sources[0];
    const sampler = samplers.get(source.id);
    const color = sampler ? sampleColor(sampler, point.x, point.y, rect) : accent;
    const fill = dots.fillMode === "solid" ? accent : color;
    context.save();
    context.globalAlpha = dots.opacity;
    const path = createShapePath(dots.shape, point.x, point.y, Math.max(8, size));
    context.translate(point.x, point.y);
    context.rotate((rng() - 0.5) * 0.45);
    context.translate(-point.x, -point.y);
    context.clip(path);
    if (dots.fillMode === "image-cutout") {
      drawCutout(context, source, point.x, point.y, Math.max(12, size * 1.6), rect);
    } else {
      context.fillStyle = fill;
      context.fill(path);
    }
    context.restore();
  });
}

function drawDecorativeDots(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  topRect: Rect,
  bottomRect: Rect,
  rng: () => number,
  palette: { primary: string; secondary: string; accent: string }
) {
  const { dots } = input.project;
  const topDecorative = Math.ceil(dots.decorativeCount * 0.68);
  const bottomDecorative = Math.max(0, dots.decorativeCount - topDecorative);
  const topPoints = createDistribution("random", topDecorative, topRect, rng, {
    minDistance: Math.max(8, dots.dotSize * 0.7),
    overflowTop: topRect.height * 0.08,
    verticalBias: "top"
  });
  const bottomPoints = input.project.layout.decorativeEverywhere
    ? createDistribution("random", bottomDecorative, bottomRect, rng, {
        minDistance: Math.max(8, dots.dotSize * 0.8),
        verticalBias: "center"
      })
    : [];
  const colors = [palette.primary, palette.secondary, palette.accent];
  [...topPoints, ...bottomPoints].forEach((point, index) => {
    const size = dots.dotSize * lerp(0.85, 1.35, rng());
    const path = createShapePath(dots.shape, point.x, point.y, size);
    context.save();
    context.globalAlpha = 0.68;
    context.fillStyle = colors[index % colors.length];
    context.fill(path);
    context.restore();
  });
}

function createDistribution(
  distribution: Distribution,
  count: number,
  rect: Rect,
  rng: () => number,
  options: DistributionOptions
) {
  if (distribution === "grid") {
    const columns = Math.max(2, Math.round(Math.sqrt(count)));
    const rows = Math.max(2, Math.ceil(count / columns));
    const points = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (points.length >= count) {
          break;
        }
        points.push({
          x: rect.x + ((column + 0.5 + (rng() - 0.5) * 0.4) / columns) * rect.width,
          y: rect.y + ((row + 0.5 + (rng() - 0.5) * 0.4) / rows) * rect.height
        });
      }
    }
    return points;
  }

  return createRandomScatter(distribution, count, rect, rng, options);
}

function createRandomScatter(
  distribution: Distribution,
  count: number,
  rect: Rect,
  rng: () => number,
  options: DistributionOptions
) {
  const points: Point[] = [];
  const attempts = Math.max(80, count * 120);
  const overflowTop = options.overflowTop ?? 0;
  const overflowBottom = options.overflowBottom ?? 0;
  const minDistanceSq = options.minDistance * options.minDistance;

  for (let attempt = 0; attempt < attempts && points.length < count; attempt += 1) {
    const x = rect.x + rng() * rect.width;
    const yNorm =
      distribution === "bottom-heavy"
        ? Math.pow(rng(), 0.58)
        : options.verticalBias === "top"
          ? Math.pow(rng(), 1.45)
          : options.verticalBias === "bottom"
            ? Math.pow(rng(), 0.65)
            : rng();
    const y =
      rect.y -
      overflowTop +
      yNorm * (rect.height + overflowTop + overflowBottom);

    if (points.every((point) => distanceSquared(point.x, point.y, x, y) >= minDistanceSq)) {
      points.push({ x, y });
    }
  }

  while (points.length < count) {
    points.push({
      x: rect.x + rng() * rect.width,
      y:
        rect.y -
        overflowTop +
        rng() * (rect.height + overflowTop + overflowBottom)
    });
  }

  return points;
}

function distanceSquared(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function sampleColor(sampler: Sampler, x: number, y: number, rect: Rect) {
  const ctx = sampler.context;
  const sx = clamp(Math.floor(((x - rect.x) / rect.width) * 63), 0, 63);
  const sy = clamp(Math.floor(((y - rect.y) / rect.height) * 63), 0, 63);
  const imageData = ctx.getImageData(sx, sy, 1, 1).data;
  return `rgba(${imageData[0]}, ${imageData[1]}, ${imageData[2]}, 1)`;
}

function drawCutout(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasSource,
  x: number,
  y: number,
  size: number,
  rect: Rect
) {
  const normalizedX = clamp((x - rect.x) / rect.width, 0.08, 0.92);
  const normalizedY = clamp((y - rect.y) / rect.height, 0.08, 0.92);
  const cropWidth = source.width * 0.14;
  const cropHeight = source.height * 0.14;
  const sx = clamp(normalizedX * source.width - cropWidth / 2, 0, source.width - cropWidth);
  const sy = clamp(normalizedY * source.height - cropHeight / 2, 0, source.height - cropHeight);
  context.drawImage(
    source.image,
    sx,
    sy,
    cropWidth,
    cropHeight,
    x - size / 2,
    y - size / 2,
    size,
    size
  );
}
