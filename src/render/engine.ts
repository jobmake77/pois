import type {
  BaseStyle,
  Distribution,
  RenderInput,
  SourceAsset
} from "../types";
import { resolveCanvasRegions, type CanvasRegion, type Rect } from "./blockLayout";
import { getCropGeometry } from "./crop";
import { clamp, lerp, mulberry32 } from "./random";
import { createShapePath } from "./shapes";

interface DistributionOptions {
  minDistance: number;
  verticalBias?: "top" | "bottom" | "center";
  avoidCenter?: number;
}

interface Sampler {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

interface CanvasSource {
  id: string;
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
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const samplers = createSamplers(sources);
  const regions = resolveCanvasRegions(input.project, input.width, input.height);
  const rng = mulberry32(input.project.dots.seed);

  context.save();
  context.clearRect(0, 0, input.width, input.height);
  context.fillStyle = input.theme.palette.surface;
  context.fillRect(0, 0, input.width, input.height);
  context.restore();

  regions.forEach((region) => {
    if (region.kind === "fill") {
      drawFillRegion(
        context,
        region.rect,
        input.project.base.style,
        input.project.base.primaryColor,
        input.project.base.secondaryColor,
        input.project.base.stripeThickness
      );
      return;
    }

    const source = region.photoId ? sourceMap.get(region.photoId) : undefined;
    if (!source) {
      drawFallbackPhoto(context, region.rect, input.theme.palette.surface);
      return;
    }
    const crop = input.project.photoCrops[source.id] ?? { x: 0, y: 0, scale: 1 };
    drawCroppedImage(context, source.image, source.width, source.height, region.rect, crop);
  });

  // 创建交叉源和采样器，用于颜色交换
  // 对于填充区域，我们需要从绘制结果中采样颜色
  const crossSources = createRegionCrossSources(context, regions);
  const crossSamplers = createSamplers(Array.from(crossSources.values()));
  
  // 创建交换映射
  const swapMap = new Map<string, { source: CanvasSource; sampler: Sampler }>();
  regions.forEach((region, index) => {
    const counterpartId = getCounterpartRegionId(region, index, regions);
    if (!counterpartId) return;
    
    // 找到对应的区域
    const counterpartRegion = regions.find(r => r.id === counterpartId);
    if (!counterpartRegion) return;
    
    // 获取对应的交叉源和采样器
    const source = crossSources.get(counterpartId);
    const sampler = source ? crossSamplers.get(source.id) : undefined;
    
    if (source && sampler) {
      swapMap.set(region.id, { source, sampler });
    }
  });

  drawShapeDots(context, input, regions, sources, sourceMap, samplers, swapMap, rng);
}

function normalizeSources(sources: SourceAsset[]): CanvasSource[] {
  return sources.map((source) => ({
    id: source.id,
    width: source.width,
    height: source.height,
    image: source.image
  }));
}

function createSamplers(sources: CanvasSource[]) {
  const map = new Map<string, Sampler>();
  for (const source of sources) {
    const size = 64;
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(size, size)
        : document.createElement("canvas");
    if (typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement) {
      canvas.width = size;
      canvas.height = size;
    }
    const samplerContext = canvas.getContext("2d");
    if (!samplerContext) {
      continue;
    }
    samplerContext.drawImage(source.image, 0, 0, size, size);
    map.set(source.id, { context: samplerContext });
  }
  return map;
}

function createRegionCrossSources(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  regions: CanvasRegion[]
) {
  const map = new Map<string, CanvasSource>();
  const canvasEl = context.canvas;
  for (const region of regions) {
    const maxSize = 320;
    let sw = region.rect.width;
    let sh = region.rect.height;
    if (sw > maxSize || sh > maxSize) {
      const scale = maxSize / Math.max(sw, sh);
      sw = Math.floor(sw * scale);
      sh = Math.floor(sh * scale);
    }
    sw = Math.max(1, sw);
    sh = Math.max(1, sh);
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(sw, sh)
        : document.createElement("canvas");
    if (typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement) {
      canvas.width = sw;
      canvas.height = sh;
    }
    const samplerContext = canvas.getContext("2d");
    if (!samplerContext) {
      continue;
    }
    samplerContext.drawImage(
      canvasEl as CanvasImageSource,
      region.rect.x,
      region.rect.y,
      region.rect.width,
      region.rect.height,
      0,
      0,
      sw,
      sh
    );
    map.set(region.id, {
      id: `cross-${region.id}`,
      width: sw,
      height: sh,
      image: canvas
    });
  }
  return map;
}

function getCounterpartRegionId(region: CanvasRegion, index: number, regions: CanvasRegion[]) {
  const other = regions.find((r, i) => i !== index && r.kind !== region.kind);
  if (other) return other.id;
  const anyOther = regions.find((r, i) => i !== index);
  return anyOther?.id;
}

function drawFallbackPhoto(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: Rect,
  surface: string
) {
  context.save();
  clipToRect(context, rect);
  context.fillStyle = surface;
  context.fillRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
  context.restore();
}

function drawCroppedImage(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  rect: Rect,
  crop: { x: number; y: number; scale: number }
) {
  const { sx, sy, sw, sh } = getCropGeometry(
    crop,
    naturalWidth,
    naturalHeight,
    rect.width,
    rect.height
  );

  context.save();
  clipToRect(context, rect);
  context.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    rect.x - 1,
    rect.y - 1,
    rect.width + 2,
    rect.height + 2
  );
  context.restore();
}

function drawFillRegion(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: Rect,
  style: BaseStyle,
  primary: string,
  secondary: string,
  stripeThickness: number
) {
  context.save();
  clipToRect(context, rect);
  if (style === "solid") {
    context.fillStyle = primary;
    context.fillRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
    context.restore();
    return;
  }

  if (style === "pixel") {
    context.fillStyle = secondary;
    context.fillRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
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
  context.fillRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
  const stripeGap = style === "duotone" ? stripeThickness * 1.8 : stripeThickness * 2;
  for (let y = rect.y; y < rect.y + rect.height; y += stripeGap) {
    context.fillStyle = primary;
    context.fillRect(rect.x, y, rect.width, stripeThickness);
  }
  context.restore();
}

function drawShapeDots(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  regions: CanvasRegion[],
  sources: CanvasSource[],
  sourceMap: Map<string, CanvasSource>,
  samplers: Map<string, Sampler>,
  swapMap: Map<string, { source: CanvasSource; sampler: Sampler }>,
  rng: () => number
) {
  const photoRegions = regions.filter((region) => region.kind === "photo");
  const fillRegions =
    input.project.fillBlockEnabled && input.project.fillBlockDotsEnabled
      ? regions.filter((region) => region.kind === "fill")
      : [];

  const photoDotBudget =
    fillRegions.length === 0
      ? input.project.dots.dotCount
      : Math.round(input.project.dots.dotCount * input.project.dots.primaryBlockShare);
  const fillDotBudget = Math.max(0, input.project.dots.dotCount - photoDotBudget);

  distributeDots(
    context,
    input,
    photoRegions,
    Math.max(photoDotBudget, photoRegions.length ? photoRegions.length : 0),
    sources,
    sourceMap,
    samplers,
    swapMap,
    rng,
    input.project.dots.photoBlockDistribution,
    true
  );
  distributeDots(
    context,
    input,
    fillRegions,
    fillDotBudget,
    sources,
    sourceMap,
    samplers,
    swapMap,
    rng,
    input.project.dots.fillBlockDistribution,
    false
  );

  const decorativePhotoBudget =
    fillRegions.length === 0
      ? input.project.dots.decorativeCount
      : Math.round(input.project.dots.decorativeCount * 0.72);
  const decorativeFillBudget =
    fillRegions.length === 0 ? 0 : Math.max(0, input.project.dots.decorativeCount - decorativePhotoBudget);

  drawDecorativeDots(context, input, photoRegions, decorativePhotoBudget, rng, true);
  drawDecorativeDots(context, input, fillRegions, decorativeFillBudget, rng, false);
}

function distributeDots(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  regions: CanvasRegion[],
  totalCount: number,
  sources: CanvasSource[],
  sourceMap: Map<string, CanvasSource>,
  samplers: Map<string, Sampler>,
  swapMap: Map<string, { source: CanvasSource; sampler: Sampler }>,
  rng: () => number,
  distribution: Distribution,
  avoidCenter: boolean
) {
  if (regions.length === 0 || totalCount <= 0) {
    return;
  }

  const counts = splitCount(totalCount, regions.length);
  regions.forEach((region, regionIndex) => {
    const points = createDistribution(distribution, counts[regionIndex], region.rect, rng, {
      minDistance:
        region.kind === "fill"
          ? Math.max(14, input.project.dots.dotSize * 0.78)
          : Math.max(12, input.project.dots.dotSize * 0.68),
      verticalBias: region.kind === "fill" ? "center" : "top",
      avoidCenter: avoidCenter ? 0.12 : 0
    });

    const swap = swapMap.get(region.id);
    const photoCrop =
      !swap && region.kind === "photo" && region.photoId
        ? (input.project.photoCrops[region.photoId] ?? { x: 0, y: 0, scale: 1 })
        : null;

    points.forEach((point, pointIndex) => {
      // 根据useSizeVariance字段决定是否使用大小变化
      const size = input.project.dots.shape === "text" || !input.project.dots.useSizeVariance
        ? Math.max(12, input.project.dots.dotSize)
        : Math.max(
            12,
            input.project.dots.dotSize + (rng() - 0.5) * input.project.dots.sizeVariance
          );
      const source = swap?.source ?? pickSourceForRegion(region, pointIndex, regionIndex, sources, sourceMap);
      const sampler = swap?.sampler ?? (source ? samplers.get(source.id) : undefined);
      const color =
        sampler && source
          ? sampleColor(sampler, point.x, point.y, region.rect, photoCrop, source)
          : input.theme.palette.accent;

      context.save();
      context.globalAlpha = input.project.dots.opacity;
      clipToRect(context, region.rect);
      const path = createShapePath(input.project.dots.shape, point.x, point.y, size);
      context.translate(point.x, point.y);
      context.rotate((rng() - 0.5) * 0.68);
      context.translate(-point.x, -point.y);
      
      if (input.project.dots.shape === "text") {
        // 绘制文本波点
        // 对于颜色交换，我们使用与普通波点相同的逻辑
        if (input.project.dots.fillMode === "image-cutout" && source) {
          // 对于image-cutout模式，使用交换的源图像颜色
          context.fillStyle = color;
        } else {
          // 对于其他模式，使用相应的颜色逻辑
          context.fillStyle = input.project.dots.fillMode === "solid" ? input.theme.palette.accent : color;
        }
        context.font = `${Math.max(8, size * 0.6)}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        const text = input.project.dots.textContent || "POIS";
        context.fillText(text, point.x, point.y);
      } else {
        // 绘制普通形状波点
        context.clip(path);
        if (input.project.dots.fillMode === "image-cutout" && source) {
          drawCutout(context, source, photoCrop, point.x, point.y, Math.max(16, size * 1.6), region.rect);
        } else {
          context.fillStyle =
            input.project.dots.fillMode === "solid" ? input.theme.palette.accent : color;
          context.fill(path);
        }
      }
      context.restore();
    });
  });
}

function drawDecorativeDots(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  regions: CanvasRegion[],
  totalCount: number,
  rng: () => number,
  avoidCenter: boolean
) {
  if (regions.length === 0 || totalCount <= 0) {
    return;
  }

  const colors = [
    input.theme.palette.primary,
    input.theme.palette.secondary,
    input.theme.palette.accent
  ];
  const counts = splitCount(totalCount, regions.length);

  regions.forEach((region, regionIndex) => {
    const points = createDistribution("random", counts[regionIndex], region.rect, rng, {
      minDistance:
        region.kind === "fill"
          ? Math.max(16, input.project.dots.dotSize * 0.84)
          : Math.max(14, input.project.dots.dotSize * 0.74),
      verticalBias: region.kind === "fill" ? "center" : "top",
      avoidCenter: avoidCenter ? 0.16 : 0
    });
    points.forEach((point, pointIndex) => {
      // 根据useSizeVariance字段决定是否使用大小变化
      const size = input.project.dots.shape === "text" || !input.project.dots.useSizeVariance
        ? Math.max(12, input.project.dots.dotSize)
        : input.project.dots.dotSize * lerp(0.86, 1.36, rng());
      context.save();
      clipToRect(context, region.rect);
      context.globalAlpha = region.kind === "fill" ? 0.46 : 0.36;
      
      // 对于文本形状，使用与主要波点相同的颜色逻辑
      if (input.project.dots.shape === "text") {
        // 绘制文本装饰波点
        // 使用与主要波点相同的颜色
        context.fillStyle = colors[(regionIndex + pointIndex) % colors.length];
        context.font = `${Math.max(8, size * 0.6)}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        const text = input.project.dots.textContent || "POIS";
        context.fillText(text, point.x, point.y);
      } else {
        // 绘制普通形状装饰波点
        context.fillStyle = colors[(regionIndex + pointIndex) % colors.length];
        const path = createShapePath(input.project.dots.shape, point.x, point.y, size);
        context.fill(path);
      }
      context.restore();
    });
  });
}

function splitCount(total: number, regionCount: number) {
  const counts = new Array(regionCount).fill(0);
  for (let index = 0; index < total; index += 1) {
    counts[index % regionCount] += 1;
  }
  return counts;
}

function pickSourceForRegion(
  region: CanvasRegion,
  pointIndex: number,
  regionIndex: number,
  sources: CanvasSource[],
  sourceMap: Map<string, CanvasSource>
) {
  if (region.kind === "photo" && region.photoId) {
    return sourceMap.get(region.photoId) ?? sources[0];
  }
  return sources[(regionIndex + pointIndex) % sources.length] ?? sources[0];
}

function clipToRect(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: Rect
) {
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
}

function createDistribution(
  distribution: Distribution,
  count: number,
  rect: Rect,
  rng: () => number,
  options: DistributionOptions
) {
  if (count <= 0) {
    return [];
  }
  if (distribution === "grid") {
    return createLooseGrid(count, rect, rng);
  }
  return createRandomScatter(distribution, count, rect, rng, options);
}

function createLooseGrid(count: number, rect: Rect, rng: () => number) {
  const columns = Math.max(2, Math.round(Math.sqrt(count)));
  const rows = Math.max(2, Math.ceil(count / columns));
  const points = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (points.length >= count) {
        break;
      }
      points.push({
        x: rect.x + ((column + 0.5 + (rng() - 0.5) * 0.72) / columns) * rect.width,
        y: rect.y + ((row + 0.5 + (rng() - 0.5) * 0.72) / rows) * rect.height
      });
    }
  }
  return points;
}

function createRandomScatter(
  distribution: Distribution,
  count: number,
  rect: Rect,
  rng: () => number,
  options: DistributionOptions
) {
  const points: Array<{ x: number; y: number }> = [];
  const minDistanceSq = options.minDistance * options.minDistance;
  const attempts = Math.max(140, count * 180);

  for (let attempt = 0; attempt < attempts && points.length < count; attempt += 1) {
    const x = rect.x + rng() * rect.width;
    const yNorm =
      distribution === "bottom-heavy"
        ? Math.pow(rng(), 0.56)
        : options.verticalBias === "top"
          ? Math.pow(rng(), 1.28)
          : options.verticalBias === "bottom"
            ? Math.pow(rng(), 0.72)
            : rng();
    const y = rect.y + yNorm * rect.height;
    const centerDistance = distanceSquared(
      x,
      y,
      rect.x + rect.width / 2,
      rect.y + rect.height / 2
    );
    const centerLimit = Math.min(rect.width, rect.height) * (options.avoidCenter ?? 0);

    if (centerLimit > 0 && centerDistance < centerLimit * centerLimit && rng() < 0.72) {
      continue;
    }

    if (points.every((point) => distanceSquared(point.x, point.y, x, y) >= minDistanceSq)) {
      points.push({ x, y });
    }
  }

  while (points.length < count) {
    points.push({
      x: rect.x + rng() * rect.width,
      y: rect.y + rng() * rect.height
    });
  }

  return points;
}

function distanceSquared(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function sampleColor(
  sampler: Sampler,
  x: number,
  y: number,
  rect: Rect,
  photoCrop: { x: number; y: number; scale: number } | null,
  source: CanvasSource
) {
  const normalizedX = clamp((x - rect.x) / rect.width, 0, 1);
  const normalizedY = clamp((y - rect.y) / rect.height, 0, 1);

  const samplerW = sampler.context.canvas.width - 1;
  const samplerH = sampler.context.canvas.height - 1;

  let sx: number, sy: number;
  if (photoCrop) {
    const { sx: cropSx, sy: cropSy, sw: cropSw, sh: cropSh } = getCropGeometry(
      photoCrop,
      source.width,
      source.height,
      rect.width,
      rect.height
    );
    const srcX = cropSx + normalizedX * cropSw;
    const srcY = cropSy + normalizedY * cropSh;
    sx = clamp(Math.floor((srcX / source.width) * samplerW), 0, samplerW);
    sy = clamp(Math.floor((srcY / source.height) * samplerH), 0, samplerH);
  } else {
    sx = clamp(Math.floor(normalizedX * samplerW), 0, samplerW);
    sy = clamp(Math.floor(normalizedY * samplerH), 0, samplerH);
  }

  const imageData = sampler.context.getImageData(sx, sy, 1, 1).data;
  return `rgba(${imageData[0]}, ${imageData[1]}, ${imageData[2]}, 1)`;
}

function drawCutout(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasSource,
  photoCrop: { x: number; y: number; scale: number } | null,
  x: number,
  y: number,
  size: number,
  rect: Rect
) {
  const normalizedX = clamp((x - rect.x) / rect.width, 0.08, 0.92);
  const normalizedY = clamp((y - rect.y) / rect.height, 0.08, 0.92);

  let sx: number, sy: number, cropWidth: number, cropHeight: number;
  if (photoCrop) {
    const { sx: cropSx, sy: cropSy, sw: cropSw, sh: cropSh } = getCropGeometry(
      photoCrop,
      source.width,
      source.height,
      rect.width,
      rect.height
    );
    cropWidth = cropSw * 0.14;
    cropHeight = cropSh * 0.14;
    sx = clamp(cropSx + normalizedX * cropSw - cropWidth / 2, cropSx, cropSx + cropSw - cropWidth);
    sy = clamp(cropSy + normalizedY * cropSh - cropHeight / 2, cropSy, cropSy + cropSh - cropHeight);
  } else {
    cropWidth = source.width * 0.14;
    cropHeight = source.height * 0.14;
    sx = clamp(normalizedX * source.width - cropWidth / 2, 0, source.width - cropWidth);
    sy = clamp(normalizedY * source.height - cropHeight / 2, 0, source.height - cropHeight);
  }

  context.drawImage(source.image, sx, sy, cropWidth, cropHeight, x - size / 2, y - size / 2, size, size);
}
