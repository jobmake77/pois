import type { PhotoCrop } from "../types";
import { clamp } from "./random";

export interface CropGeometry {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  maxShiftX: number;
  maxShiftY: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 2.6;

export function createDefaultPhotoCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): PhotoCrop {
  const crop = clampPhotoCrop(
    { x: 0, y: sourceWidth / sourceHeight < targetWidth / targetHeight ? -0.08 : -0.02, scale: 1 },
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  return crop;
}

export function clampPhotoCrop(
  crop: PhotoCrop,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): PhotoCrop {
  const scale = clamp(Number((crop.scale || 1).toFixed(4)), MIN_SCALE, MAX_SCALE);
  const geometry = getCropGeometry(
    { x: crop.x, y: crop.y, scale },
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  return cropFromGeometry(geometry, scale, sourceWidth, sourceHeight);
}

export function getCropGeometry(
  crop: PhotoCrop,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): CropGeometry {
  const scale = clamp(crop.scale || 1, MIN_SCALE, MAX_SCALE);
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;

  let baseWidth = sourceWidth;
  let baseHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    baseWidth = sourceHeight * targetRatio;
  } else {
    baseHeight = sourceWidth / targetRatio;
  }

  const sw = baseWidth / scale;
  const sh = baseHeight / scale;
  const maxShiftX = Math.max(0, sourceWidth - sw);
  const maxShiftY = Math.max(0, sourceHeight - sh);
  const sx = clamp(((crop.x + 1) / 2) * maxShiftX, 0, maxShiftX);
  const sy = clamp(((crop.y + 1) / 2) * maxShiftY, 0, maxShiftY);

  return {
    sx,
    sy,
    sw,
    sh,
    maxShiftX,
    maxShiftY
  };
}

export function translatePhotoCrop(
  crop: PhotoCrop,
  deltaX: number,
  deltaY: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const safeCrop = clampPhotoCrop(crop, sourceWidth, sourceHeight, targetWidth, targetHeight);
  const geometry = getCropGeometry(
    safeCrop,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  const nextSx = clamp(
    geometry.sx - deltaX * (geometry.sw / targetWidth) * 0.92,
    0,
    geometry.maxShiftX
  );
  const nextSy = clamp(
    geometry.sy - deltaY * (geometry.sh / targetHeight) * 0.92,
    0,
    geometry.maxShiftY
  );
  return cropFromSourceWindow(
    nextSx,
    nextSy,
    safeCrop.scale,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
}

export function scalePhotoCropFromAnchor(
  crop: PhotoCrop,
  nextScale: number,
  anchorX: number,
  anchorY: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const safeCrop = clampPhotoCrop(crop, sourceWidth, sourceHeight, targetWidth, targetHeight);
  const geometry = getCropGeometry(
    safeCrop,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  const clampedAnchorX = clamp(anchorX, 0, 1);
  const clampedAnchorY = clamp(anchorY, 0, 1);
  const sourceAnchorX = geometry.sx + geometry.sw * clampedAnchorX;
  const sourceAnchorY = geometry.sy + geometry.sh * clampedAnchorY;
  const nextGeometry = getCropGeometry(
    { x: 0, y: 0, scale: nextScale },
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  const nextSx = clamp(
    sourceAnchorX - nextGeometry.sw * clampedAnchorX,
    0,
    nextGeometry.maxShiftX
  );
  const nextSy = clamp(
    sourceAnchorY - nextGeometry.sh * clampedAnchorY,
    0,
    nextGeometry.maxShiftY
  );

  return cropFromSourceWindow(
    nextSx,
    nextSy,
    clamp(nextScale, MIN_SCALE, MAX_SCALE),
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
}

function cropFromSourceWindow(
  sx: number,
  sy: number,
  scale: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const geometry = getCropGeometry(
    { x: 0, y: 0, scale },
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );

  return cropFromGeometry(
    {
      ...geometry,
      sx,
      sy
    },
    scale,
    sourceWidth,
    sourceHeight
  );
}

function cropFromGeometry(
  geometry: CropGeometry,
  scale: number,
  _sourceWidth: number,
  _sourceHeight: number
): PhotoCrop {
  const x =
    geometry.maxShiftX <= 0 ? 0 : clamp((geometry.sx / geometry.maxShiftX) * 2 - 1, -1, 1);
  const y =
    geometry.maxShiftY <= 0 ? 0 : clamp((geometry.sy / geometry.maxShiftY) * 2 - 1, -1, 1);
  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    scale: Number(scale.toFixed(4))
  };
}
