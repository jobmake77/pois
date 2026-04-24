import type { ExtractedPaletteColor } from "../types";

interface PaletteBucket {
  red: number;
  green: number;
  blue: number;
  count: number;
}

export async function extractPaletteFromImage(
  image: CanvasImageSource,
  colorCount = 6
): Promise<ExtractedPaletteColor[]> {
  const surface = createCanvasSurface(72, 72);
  if (!surface) {
    return [];
  }

  surface.context.drawImage(image, 0, 0, surface.canvas.width, surface.canvas.height);
  const imageData = surface.context.getImageData(0, 0, surface.canvas.width, surface.canvas.height);
  return extractPaletteFromImageData(imageData.data, colorCount);
}

export function extractPaletteFromImageData(
  rgba: Uint8ClampedArray,
  colorCount = 6
): ExtractedPaletteColor[] {
  const quantized = new Map<string, PaletteBucket>();

  for (let index = 0; index < rgba.length; index += 4) {
    const alpha = rgba[index + 3];
    if (alpha < 24) {
      continue;
    }

    const red = quantizeChannel(rgba[index]);
    const green = quantizeChannel(rgba[index + 1]);
    const blue = quantizeChannel(rgba[index + 2]);
    const key = `${red}:${green}:${blue}`;
    const bucket = quantized.get(key) ?? {
      red: 0,
      green: 0,
      blue: 0,
      count: 0
    };

    bucket.red += rgba[index];
    bucket.green += rgba[index + 1];
    bucket.blue += rgba[index + 2];
    bucket.count += 1;
    quantized.set(key, bucket);
  }

  const total = Array.from(quantized.values()).reduce((sum, bucket) => sum + bucket.count, 0);
  if (total === 0) {
    return [];
  }

  const sorted = Array.from(quantized.values())
    .sort((left, right) => right.count - left.count)
    .map((bucket) => ({
      red: Math.round(bucket.red / bucket.count),
      green: Math.round(bucket.green / bucket.count),
      blue: Math.round(bucket.blue / bucket.count),
      weight: bucket.count / total
    }));

  const deduped = sorted.filter((candidate, index, current) =>
    current.findIndex((other) => colorDistance(candidate, other) < 28) === index
  );

  return deduped.slice(0, colorCount).map((color) => ({
    hex: toHex(color.red, color.green, color.blue),
    weight: Number(color.weight.toFixed(4))
  }));
}

function quantizeChannel(value: number) {
  return Math.floor(value / 24) * 24;
}

function colorDistance(
  left: { red: number; green: number; blue: number },
  right: { red: number; green: number; blue: number }
) {
  const red = left.red - right.red;
  const green = left.green - right.green;
  const blue = left.blue - right.blue;
  return Math.sqrt(red * red + green * green + blue * blue);
}

function toHex(red: number, green: number, blue: number) {
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
}

function toHexChannel(value: number) {
  return value.toString(16).padStart(2, "0");
}

function createCanvasSurface(width: number, height: number) {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  return { canvas, context };
}
