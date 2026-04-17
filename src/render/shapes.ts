import type { ShapeKind } from "../types";

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
    path.moveTo(x, y + half * 0.88);
    path.bezierCurveTo(x - half * 1.02, y + half * 0.18, x - half * 1.08, y - half * 0.48, x - half * 0.28, y - half * 0.22);
    path.arc(x - half * 0.28, y - half * 0.22, half * 0.34, Math.PI * 0.92, Math.PI * 0.08, true);
    path.arc(x + half * 0.28, y - half * 0.22, half * 0.34, Math.PI * 1.08, Math.PI * 0.2, true);
    path.bezierCurveTo(x + half * 1.08, y - half * 0.48, x + half * 1.02, y + half * 0.18, x, y + half * 0.88);
    path.closePath();
    return path;
  }

  if (shape === "meteor") {
    path.moveTo(x - half * 1.08, y + half * 0.22);
    path.lineTo(x - half * 0.2, y + half * 0.06);
    path.lineTo(x + half * 0.18, y + half * 0.44);
    path.lineTo(x + half * 0.94, y - half * 0.38);
    path.lineTo(x + half * 0.22, y - half * 0.16);
    path.lineTo(x - half * 0.08, y - half * 0.62);
    path.lineTo(x - half * 0.26, y - half * 0.12);
    path.lineTo(x - half * 1.08, y + half * 0.22);
    path.closePath();
    return path;
  }

  if (shape === "butterfly") {
    path.moveTo(x, y - half * 0.72);
    path.bezierCurveTo(x - half * 0.96, y - half * 1.08, x - half * 1.02, y - half * 0.04, x - half * 0.2, y - half * 0.04);
    path.bezierCurveTo(x - half * 1.04, y + half * 0.08, x - half * 0.92, y + half * 1.06, x, y + half * 0.42);
    path.bezierCurveTo(x + half * 0.92, y + half * 1.06, x + half * 1.04, y + half * 0.08, x + half * 0.2, y - half * 0.04);
    path.bezierCurveTo(x + half * 1.02, y - half * 0.04, x + half * 0.96, y - half * 1.08, x, y - half * 0.72);
    path.closePath();
    path.rect(x - half * 0.08, y - half * 0.68, half * 0.16, size * 1.12);
    return path;
  }

  if (shape === "kitty") {
    path.moveTo(x - half * 0.74, y - half * 0.12);
    path.lineTo(x - half * 0.54, y - half * 0.92);
    path.lineTo(x - half * 0.14, y - half * 0.42);
    path.arc(x, y + half * 0.02, half * 0.72, Math.PI * 1.22, Math.PI * 1.78);
    path.lineTo(x + half * 0.54, y - half * 0.92);
    path.lineTo(x + half * 0.74, y - half * 0.12);
    path.arc(x, y + half * 0.02, half * 0.74, Math.PI * 1.96, Math.PI * 1.06, true);
    path.closePath();
    return path;
  }

  if (shape === "dog") {
    path.moveTo(x - half * 0.82, y - half * 0.08);
    path.bezierCurveTo(x - half * 1.08, y - half * 0.78, x - half * 0.72, y - half * 1.02, x - half * 0.32, y - half * 0.46);
    path.arc(x, y + half * 0.06, half * 0.68, Math.PI * 1.1, Math.PI * 1.9);
    path.bezierCurveTo(x + half * 0.72, y - half * 1.02, x + half * 1.08, y - half * 0.78, x + half * 0.82, y - half * 0.08);
    path.arc(x, y + half * 0.08, half * 0.76, Math.PI * 1.98, Math.PI * 1.02, true);
    path.closePath();
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
