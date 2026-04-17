import type { PhotoCrop, PhotoFitMode } from "../types";
import { clamp } from "./random";

export interface PhotoRenderGeometry {
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  baseX: number;
  baseY: number;
  maxShiftX: number;
  maxShiftY: number;
  renderScale: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 2.6;

export function createDefaultPhotoCrop(
  _sourceWidth: number,
  _sourceHeight: number,
  _targetWidth: number,
  _targetHeight: number
): PhotoCrop {
  return {
    x: 0,
    y: 0,
    scale: 1,
    fitMode: "contain"
  };
}

export function clampPhotoCrop(
  crop: PhotoCrop,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): PhotoCrop {
  const fitMode: PhotoFitMode = crop.fitMode === "cover" ? "cover" : "contain";
  const scale = clamp(Number((crop.scale || 1).toFixed(4)), MIN_SCALE, MAX_SCALE);
  const geometry = getPhotoRenderGeometry(
    { x: crop.x, y: crop.y, scale, fitMode },
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  return cropFromGeometry(geometry, scale, fitMode);
}

export function getPhotoRenderGeometry(
  crop: PhotoCrop,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): PhotoRenderGeometry {
  const fitMode: PhotoFitMode = crop.fitMode === "cover" ? "cover" : "contain";
  const baseScale = getBaseScale(fitMode, sourceWidth, sourceHeight, targetWidth, targetHeight);
  const renderScale = baseScale * clamp(crop.scale || 1, MIN_SCALE, MAX_SCALE);
  const drawWidth = sourceWidth * renderScale;
  const drawHeight = sourceHeight * renderScale;
  const baseX = (targetWidth - drawWidth) / 2;
  const baseY = (targetHeight - drawHeight) / 2;
  const maxShiftX = Math.max(0, (drawWidth - targetWidth) / 2);
  const maxShiftY = Math.max(0, (drawHeight - targetHeight) / 2);
  const drawX = baseX + clamp(maxShiftX > 0 ? crop.x : 0, -1, 1) * maxShiftX;
  const drawY = baseY + clamp(maxShiftY > 0 ? crop.y : 0, -1, 1) * maxShiftY;

  return {
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    baseX,
    baseY,
    maxShiftX,
    maxShiftY,
    renderScale
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
  const geometry = getPhotoRenderGeometry(
    safeCrop,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  const shiftX = clamp(geometry.drawX - geometry.baseX + deltaX, -geometry.maxShiftX, geometry.maxShiftX);
  const shiftY = clamp(geometry.drawY - geometry.baseY + deltaY, -geometry.maxShiftY, geometry.maxShiftY);

  return cropFromGeometry(
    {
      ...geometry,
      drawX: geometry.baseX + shiftX,
      drawY: geometry.baseY + shiftY
    },
    safeCrop.scale,
    safeCrop.fitMode
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
  const geometry = getPhotoRenderGeometry(
    safeCrop,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  const localAnchorX = clamp(anchorX, 0, 1) * targetWidth;
  const localAnchorY = clamp(anchorY, 0, 1) * targetHeight;
  const sourceAnchorX = clamp((localAnchorX - geometry.drawX) / geometry.drawWidth, 0, 1);
  const sourceAnchorY = clamp((localAnchorY - geometry.drawY) / geometry.drawHeight, 0, 1);
  const nextCrop = clampPhotoCrop(
    {
      ...safeCrop,
      scale: nextScale
    },
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  const nextGeometry = getPhotoRenderGeometry(
    nextCrop,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );
  const desiredDrawX = localAnchorX - sourceAnchorX * nextGeometry.drawWidth;
  const desiredDrawY = localAnchorY - sourceAnchorY * nextGeometry.drawHeight;

  return cropFromGeometry(
    {
      ...nextGeometry,
      drawX: clamp(
        desiredDrawX,
        nextGeometry.baseX - nextGeometry.maxShiftX,
        nextGeometry.baseX + nextGeometry.maxShiftX
      ),
      drawY: clamp(
        desiredDrawY,
        nextGeometry.baseY - nextGeometry.maxShiftY,
        nextGeometry.baseY + nextGeometry.maxShiftY
      )
    },
    nextCrop.scale,
    nextCrop.fitMode
  );
}

function cropFromGeometry(
  geometry: PhotoRenderGeometry,
  scale: number,
  fitMode: PhotoFitMode
): PhotoCrop {
  const x =
    geometry.maxShiftX <= 0
      ? 0
      : clamp((geometry.drawX - geometry.baseX) / geometry.maxShiftX, -1, 1);
  const y =
    geometry.maxShiftY <= 0
      ? 0
      : clamp((geometry.drawY - geometry.baseY) / geometry.maxShiftY, -1, 1);

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    scale: Number(scale.toFixed(4)),
    fitMode
  };
}

function getBaseScale(
  fitMode: PhotoFitMode,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const scaleX = targetWidth / sourceWidth;
  const scaleY = targetHeight / sourceHeight;
  return fitMode === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
}
