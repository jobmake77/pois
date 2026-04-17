import type { BaseStyle, RenderInput, SourceAsset } from "../types";
import { resolvePanels, type CanvasPanel, type Rect } from "./blockLayout";
import { getPhotoRenderGeometry } from "./crop";
import { createDotModel, projectDot, projectDotToLocalPoint, type DotModel, type SharedDot } from "./dotModel";
import { clamp, lerp } from "./random";
import { createShapePath } from "./shapes";

interface CanvasSource {
  id: string;
  width: number;
  height: number;
  image: CanvasImageSource;
}

interface PanelSurface {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  kind: CanvasPanel["kind"];
}

export async function renderToCanvas(canvas: HTMLCanvasElement, input: RenderInput) {
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

export async function renderPanelToCanvas(
  canvas: HTMLCanvasElement,
  input: RenderInput,
  panelRole: "primary" | "secondary",
  referencePanels = resolvePanels(input.project, input.project.canvasWidth, input.project.canvasHeight, input.sources)
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

  const sources = normalizeSources(input.sources);
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const surfaceMap = createPanelSurfaceMap(input, referencePanels, sourceMap);
  const dotModel = createDotModel(input.project, referencePanels);
  const panel = referencePanels.find((item) => item.role === panelRole);
  const panelSurface = surfaceMap.get(panelRole);
  if (!panel || !panelSurface) {
    context.clearRect(0, 0, targetWidth, targetHeight);
    return;
  }

  const localPanel: CanvasPanel = {
    ...panel,
    rect: {
      x: 0,
      y: 0,
      width: targetWidth,
      height: targetHeight
    }
  };

  context.save();
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.drawImage(panelSurface.canvas as CanvasImageSource, 0, 0, targetWidth, targetHeight);
  drawPanelDots(context, input, localPanel, dotModel, surfaceMap);
  context.restore();
}

export async function renderToOffscreenBlob(input: RenderInput, type = "image/png") {
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

export async function renderToBlobOnMain(input: RenderInput, type = "image/png") {
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
  const panels = resolvePanels(input.project, input.width, input.height, input.sources);
  const surfaceMap = createPanelSurfaceMap(input, panels, sourceMap);
  const dotModel = createDotModel(input.project, panels);

  context.save();
  context.clearRect(0, 0, input.width, input.height);
  context.fillStyle = input.theme.palette.surface;
  context.fillRect(0, 0, input.width, input.height);
  panels.forEach((panel) => {
    const surface = surfaceMap.get(panel.role);
    if (!surface) {
      return;
    }
    context.drawImage(
      surface.canvas as CanvasImageSource,
      panel.rect.x,
      panel.rect.y,
      panel.rect.width,
      panel.rect.height
    );
  });
  panels.forEach((panel) => {
    drawPanelDots(context, input, panel, dotModel, surfaceMap);
  });
  context.restore();
}

function normalizeSources(sources: SourceAsset[]): CanvasSource[] {
  return sources.map((source) => ({
    id: source.id,
    width: source.width,
    height: source.height,
    image: source.image
  }));
}

function createPanelSurfaceMap(
  input: RenderInput,
  panels: CanvasPanel[],
  sourceMap: Map<string, CanvasSource>
) {
  const map = new Map<CanvasPanel["role"], PanelSurface>();
  panels.forEach((panel) => {
    const width = Math.max(1, Math.round(panel.rect.width));
    const height = Math.max(1, Math.round(panel.rect.height));
    const surface = createScratchSurface(width, height);
    if (!surface) {
      return;
    }
    drawPanelSurface(
      surface.context,
      input,
      {
        ...panel,
        rect: { x: 0, y: 0, width, height }
      },
      sourceMap
    );
    map.set(panel.role, {
      canvas: surface.canvas,
      width,
      height,
      kind: panel.kind
    });
  });
  return map;
}

function drawPanelSurface(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  panel: CanvasPanel,
  sourceMap: Map<string, CanvasSource>
) {
  context.save();
  clipToRect(context, panel.rect);
  context.fillStyle = input.project.base.backgroundTone || input.theme.palette.surface;
  context.fillRect(panel.rect.x, panel.rect.y, panel.rect.width, panel.rect.height);

  if (panel.kind === "photo" && panel.photoId) {
    const source = sourceMap.get(panel.photoId);
    if (source) {
      const crop = input.project.photoCrops[panel.photoId] ?? {
        x: 0,
        y: 0,
        scale: 1,
        fitMode: "contain" as const
      };
      drawPhotoSurface(context, panel.rect, source, crop);
      context.restore();
      return;
    }
  }

  drawFillRegion(
    context,
    panel.rect,
    input.project.base.style,
    input.project.base.primaryColor,
    input.project.base.secondaryColor,
    input.project.base.stripeThickness,
    input.project.panelDirection
  );
  context.restore();
}

function drawPhotoSurface(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: Rect,
  source: CanvasSource,
  crop: RenderInput["project"]["photoCrops"][string]
) {
  const geometry = getPhotoRenderGeometry(
    crop,
    source.width,
    source.height,
    rect.width,
    rect.height
  );
  context.drawImage(
    source.image,
    rect.x + geometry.drawX,
    rect.y + geometry.drawY,
    geometry.drawWidth,
    geometry.drawHeight
  );
}

function drawPanelDots(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  panel: CanvasPanel,
  dotModel: DotModel,
  surfaceMap: Map<CanvasPanel["role"], PanelSurface>
) {
  const panelMin = Math.max(1, Math.min(panel.rect.width, panel.rect.height));
  const sizeScale = panelMin / dotModel.referencePanelMin;
  const sampleSurface = getSamplingSurface(panel.role, surfaceMap);
  const { dots, decorativeDots } = getPanelDotSets(input, panel, dotModel);

  dots.forEach((dot, index) => {
    const point = projectDot(dot, panel.rect);
    const samplePoint = sampleSurface
      ? projectDotToLocalPoint(dot, sampleSurface.width, sampleSurface.height)
      : null;
    const color = getDotColor(input, sampleSurface, samplePoint);
    drawSingleDot(context, input, panel, point, getDotSize(input, dot, sizeScale), dot, color, sampleSurface, samplePoint);
    if (index < decorativeDots.length) {
      const decorative = decorativeDots[index];
      const decorativePoint = projectDot(decorative, panel.rect);
      const decorativeSamplePoint = sampleSurface
        ? projectDotToLocalPoint(decorative, sampleSurface.width, sampleSurface.height)
        : null;
      drawDecorativeDot(
        context,
        input,
        panel,
        decorativePoint,
        decorative.varianceSample,
        sizeScale,
        index,
        getDotColor(input, sampleSurface, decorativeSamplePoint),
        sampleSurface,
        decorativeSamplePoint
      );
    }
  });
}

function getPanelDotSets(
  input: RenderInput,
  panel: CanvasPanel,
  dotModel: DotModel
) {
  if (input.project.dots.distribution === "single-side") {
    return panel.role === "primary"
      ? { dots: dotModel.primaryDots, decorativeDots: dotModel.decorativePrimary }
      : { dots: dotModel.secondaryDots, decorativeDots: dotModel.decorativeSecondary };
  }

  if (input.project.dots.distribution === "random") {
    return panel.role === "primary"
      ? { dots: dotModel.primaryDots, decorativeDots: dotModel.decorativePrimary }
      : { dots: dotModel.secondaryDots, decorativeDots: dotModel.decorativeSecondary };
  }

  return {
    dots: dotModel.sharedDots,
    decorativeDots: dotModel.decorativeShared
  };
}

function getSamplingSurface(
  role: CanvasPanel["role"],
  surfaceMap: Map<CanvasPanel["role"], PanelSurface>
) {
  if (role === "primary") {
    return surfaceMap.get("secondary") ?? surfaceMap.get("primary");
  }
  return surfaceMap.get("primary") ?? surfaceMap.get("secondary");
}

function getDotSize(input: RenderInput, dot: SharedDot, sizeScale: number) {
  const baseSize = input.project.dots.useSizeVariance
    ? input.project.dots.dotSize + (dot.varianceSample - 0.5) * input.project.dots.sizeVariance
    : input.project.dots.dotSize;
  return Math.max(10, baseSize * (dot.sizeMultiplier ?? 1) * sizeScale);
}

function drawSingleDot(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  panel: CanvasPanel,
  point: { x: number; y: number },
  size: number,
  dot: SharedDot,
  color: string,
  sampleSurface: PanelSurface | undefined,
  samplePoint: { x: number; y: number } | null
) {
  context.save();
  clipToRect(context, panel.rect);
  context.globalAlpha = input.project.dots.opacity;
  const rotation = (dot.rotationSeed - 0.5) * 0.72;
  context.translate(point.x, point.y);
  context.rotate(rotation);
  context.translate(-point.x, -point.y);

  if (input.project.dots.shape === "text") {
    const fontSize = Math.max(
      10,
      input.project.dots.fontSize * (size / Math.max(1, input.project.dots.dotSize))
    );
    const text = input.project.dots.textContent || "POIS";
    if (input.project.dots.fillMode === "image-cutout" && sampleSurface && samplePoint) {
      drawTextCutoutFromSurface(context, sampleSurface, samplePoint, point, fontSize, text);
      context.restore();
      return;
    }
    context.fillStyle =
      input.project.dots.fillMode === "solid" ? input.theme.palette.accent : color;
    context.font = `${fontSize}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, point.x, point.y);
    context.restore();
    return;
  }

  const path = createShapePath(input.project.dots.shape, point.x, point.y, size);
  context.clip(path);
  if (input.project.dots.fillMode === "image-cutout" && sampleSurface && samplePoint) {
    drawSurfaceCutout(context, sampleSurface, panel.rect);
  } else {
    context.fillStyle =
      input.project.dots.fillMode === "solid" ? input.theme.palette.accent : color;
    context.fill(path);
  }
  context.restore();
}

function drawDecorativeDot(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: RenderInput,
  panel: CanvasPanel,
  point: { x: number; y: number },
  varianceSample: number,
  sizeScale: number,
  index: number,
  color: string,
  sampleSurface: PanelSurface | undefined,
  samplePoint: { x: number; y: number } | null
) {
  const size = Math.max(8, input.project.dots.dotSize * lerp(0.6, 1.05, varianceSample) * sizeScale);
  context.save();
  clipToRect(context, panel.rect);
  context.globalAlpha = panel.kind === "fill" ? 0.36 : 0.24;
  if (input.project.dots.shape === "text") {
    if (input.project.dots.fillMode === "image-cutout" && sampleSurface && samplePoint) {
      drawTextCutoutFromSurface(
        context,
        sampleSurface,
        samplePoint,
        point,
        Math.max(8, input.project.dots.fontSize * 0.82 * sizeScale),
        input.project.dots.textContent || "POIS"
      );
      context.restore();
      return;
    }
    context.fillStyle =
      input.project.dots.fillMode === "solid" ? input.theme.palette.accent : color;
    context.font = `${Math.max(8, input.project.dots.fontSize * 0.82 * sizeScale)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(input.project.dots.textContent || "POIS", point.x, point.y);
    context.restore();
    return;
  }
  const path = createShapePath(input.project.dots.shape, point.x, point.y, size);
  context.clip(path);
  if (input.project.dots.fillMode === "image-cutout" && sampleSurface && samplePoint) {
    drawSurfaceCutout(context, sampleSurface, panel.rect);
  } else {
    context.fillStyle =
      input.project.dots.fillMode === "solid" ? input.theme.palette.accent : color;
    context.fill(path);
  }
  context.restore();
}

function getDotColor(
  input: RenderInput,
  sampleSurface: PanelSurface | undefined,
  samplePoint: { x: number; y: number } | null
) {
  if (input.project.dots.fillMode === "solid") {
    return input.theme.palette.accent;
  }
  if (sampleSurface && samplePoint) {
    return sampleCanvasColor(sampleSurface.canvas, samplePoint.x, samplePoint.y);
  }
  return input.theme.palette.accent;
}

function drawFillRegion(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: Rect,
  style: BaseStyle,
  primary: string,
  secondary: string,
  stripeThickness: number,
  panelDirection: "horizontal" | "vertical"
) {
  if (style === "solid") {
    context.fillStyle = primary;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  if (style === "pixel") {
    context.fillStyle = secondary;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    const block = Math.max(8, stripeThickness);
    for (let y = 0; y < rect.height; y += block) {
      for (let x = 0; x < rect.width; x += block) {
        const even = (Math.floor(x / block) + Math.floor(y / block)) % 2 === 0;
        context.fillStyle = even ? primary : secondary;
        context.fillRect(rect.x + x, rect.y + y, block, block);
      }
    }
    return;
  }

  context.fillStyle = secondary;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  const stripeGap = style === "duotone" ? stripeThickness * 1.8 : stripeThickness * 2;
  if (panelDirection === "vertical") {
    for (let x = rect.x; x < rect.x + rect.width; x += stripeGap) {
      context.fillStyle = primary;
      context.fillRect(x, rect.y, stripeThickness, rect.height);
    }
    return;
  }

  for (let y = rect.y; y < rect.y + rect.height; y += stripeGap) {
    context.fillStyle = primary;
    context.fillRect(rect.x, y, rect.width, stripeThickness);
  }
}

function clipToRect(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: Rect
) {
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
}

function sampleCanvasColor(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  x: number,
  y: number
) {
  const context = canvas.getContext("2d");
  if (!context) {
    return "rgba(0,0,0,1)";
  }
  const px = clamp(Math.floor(x), 0, canvas.width - 1);
  const py = clamp(Math.floor(y), 0, canvas.height - 1);
  const data = context.getImageData(px, py, 1, 1).data;
  return `rgba(${data[0]}, ${data[1]}, ${data[2]}, 1)`;
}

function drawSurfaceCutout(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  surface: PanelSurface,
  rect: Rect
) {
  context.drawImage(
    surface.canvas as CanvasImageSource,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  );
}

function drawTextCutoutFromSurface(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  surface: PanelSurface,
  samplePoint: { x: number; y: number },
  point: { x: number; y: number },
  fontSize: number,
  text: string
) {
  const font = `${fontSize}px sans-serif`;
  const measureSurface = createScratchSurface(1, 1);
  if (!measureSurface) {
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, point.x, point.y);
    return;
  }

  measureSurface.context.font = font;
  const metrics = measureSurface.context.measureText(text);
  const textWidth = Math.max(1, Math.ceil(metrics.width + fontSize * 0.5));
  const textHeight = Math.max(1, Math.ceil(fontSize * 1.6));
  const maskSurface = createScratchSurface(textWidth, textHeight);
  if (!maskSurface) {
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, point.x, point.y);
    return;
  }

  const cropWidth = Math.max(textWidth, fontSize);
  const cropHeight = Math.max(textHeight, fontSize);
  const fillScale = surface.kind === "fill" ? 1.8 : 1;
  const sourceWidth = cropWidth * fillScale;
  const sourceHeight = cropHeight * fillScale;
  const sx = clamp(samplePoint.x - sourceWidth / 2, 0, surface.width - sourceWidth);
  const sy = clamp(samplePoint.y - sourceHeight / 2, 0, surface.height - sourceHeight);
  maskSurface.context.drawImage(
    surface.canvas as CanvasImageSource,
    sx,
    sy,
    sourceWidth,
    sourceHeight,
    0,
    0,
    textWidth,
    textHeight
  );
  maskSurface.context.globalCompositeOperation = "destination-in";
  maskSurface.context.font = font;
  maskSurface.context.textAlign = "center";
  maskSurface.context.textBaseline = "middle";
  maskSurface.context.fillStyle = "#000000";
  maskSurface.context.fillText(text, textWidth / 2, textHeight / 2);
  context.drawImage(
    maskSurface.canvas as CanvasImageSource,
    point.x - textWidth / 2,
    point.y - textHeight / 2
  );
}

function createScratchSurface(width: number, height: number) {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : document.createElement("canvas");
  if (typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  return { canvas, context };
}
