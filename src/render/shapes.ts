import type { ShapeKind } from "../types";
import { FILLED_SHAPE_GLYPHS } from "./shapeGlyphs";

export function createShapePath(
  shape: ShapeKind,
  x: number,
  y: number,
  size: number
) {
  const path = new Path2D();
  const half = size / 2;

  if (shape === "circle") {
    path.arc(x, y, half, 0, Math.PI * 2);
    return path;
  }

  if (shape === "square") {
    path.rect(x - half, y - half, size, size);
    return path;
  }

  if (shape === "drop") {
    path.moveTo(x, y - half);
    path.bezierCurveTo(x + half * 0.82, y - half * 0.08, x + half * 0.88, y + half * 0.72, x, y + half);
    path.bezierCurveTo(x - half * 0.88, y + half * 0.72, x - half * 0.82, y - half * 0.08, x, y - half);
    path.closePath();
    return path;
  }

  if (shape === "snowflake") {
    const arm = Math.max(4, size * 0.44);
    const branch = Math.max(2, size * 0.09);
    const diagonal = arm * 0.72;
    drawPixelRect(path, x - branch / 2, y - arm, branch, arm * 2);
    drawPixelRect(path, x - arm, y - branch / 2, arm * 2, branch);
    drawRotatedBranch(path, x, y, diagonal, branch, Math.PI / 4);
    drawRotatedBranch(path, x, y, diagonal, branch, -Math.PI / 4);
    return path;
  }

  if (shape === "heart") {
    appendGlyphPath(path, FILLED_SHAPE_GLYPHS.heart, x, y, size);
    return path;
  }

  if (shape === "butterfly") {
    appendGlyphPath(path, FILLED_SHAPE_GLYPHS.butterfly, x, y, size);
    return path;
  }

  if (shape === "kitty") {
    appendGlyphPath(path, FILLED_SHAPE_GLYPHS.kitty, x, y, size);
    return path;
  }

  if (shape === "text") {
    path.rect(x - half, y - half, size, size);
    return path;
  }

  drawStar(path, x, y, half);
  return path;
}

function drawStar(path: Path2D, x: number, y: number, half: number) {
  const spikes = 5;
  const outer = half;
  const inner = half * 0.46;
  const start = -Math.PI / 2;
  for (let index = 0; index < spikes * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = start + (Math.PI / spikes) * index;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) {
      path.moveTo(px, py);
    } else {
      path.lineTo(px, py);
    }
  }
  path.closePath();
}

function drawPixelRect(path: Path2D, x: number, y: number, width: number, height: number) {
  path.rect(x, y, width, height);
}

function drawRotatedBranch(
  path: Path2D,
  x: number,
  y: number,
  length: number,
  thickness: number,
  angle: number
) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfThickness = thickness / 2;
  const points = [
    { x: -halfThickness, y: -length },
    { x: halfThickness, y: -length },
    { x: halfThickness, y: length },
    { x: -halfThickness, y: length }
  ].map((point) => ({
    x: x + point.x * cos - point.y * sin,
    y: y + point.x * sin + point.y * cos
  }));

  path.moveTo(points[0].x, points[0].y);
  path.lineTo(points[1].x, points[1].y);
  path.lineTo(points[2].x, points[2].y);
  path.lineTo(points[3].x, points[3].y);
  path.closePath();
}

function appendGlyphPath(
  path: Path2D,
  glyph: string,
  x: number,
  y: number,
  size: number
) {
  const sourcePath = new Path2D(glyph);
  const scale = size / 24;
  const transform = new DOMMatrix()
    .translateSelf(x - size / 2, y - size / 2)
    .scaleSelf(scale, scale);
  path.addPath(sourcePath, transform);
}
