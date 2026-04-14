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
    path.bezierCurveTo(x + half * 0.72, y - half * 0.25, x + half, y + half * 0.18, x, y + half);
    path.bezierCurveTo(x - half, y + half * 0.18, x - half * 0.72, y - half * 0.25, x, y - half);
    path.closePath();
    return path;
  }

  if (shape === "snowflake") {
    const arm = Math.max(3, size * 0.42);
    const pix = Math.max(2, size * 0.08);
    drawPixelRect(path, x - pix / 2, y - arm, pix, arm * 2);
    drawPixelRect(path, x - arm, y - pix / 2, arm * 2, pix);
    drawPixelRect(path, x - arm * 0.72, y - arm * 0.72, pix, arm * 1.44);
    drawPixelRect(path, x + arm * 0.72 - pix, y - arm * 0.72, pix, arm * 1.44);
    drawPixelRect(path, x - arm * 0.72, y + arm * 0.72 - pix, arm * 1.44, pix);
    drawPixelRect(path, x - arm * 0.72, y - arm * 0.72, arm * 1.44, pix);
    return path;
  }

  if (shape === "text") {
    // 对于文本形状，我们创建一个矩形路径作为边界
    path.rect(x - half, y - half, size, size);
    return path;
  }

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
  return path;
}

function drawPixelRect(path: Path2D, x: number, y: number, width: number, height: number) {
  path.rect(x, y, width, height);
}
