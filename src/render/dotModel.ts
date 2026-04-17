import type { ProjectState } from "../types";
import type { CanvasPanel, Rect } from "./blockLayout";
import { clamp, mulberry32 } from "./random";

export interface SharedDot {
  id: string;
  xRatio: number;
  yRatio: number;
  profileSample: number;
  varianceSample: number;
  rotationSeed: number;
  sizeMultiplier?: number;
}

export interface DecorativeDot {
  xRatio: number;
  yRatio: number;
  profileSample: number;
  varianceSample: number;
  rotationSeed: number;
}

export interface DotModel {
  sharedDots: SharedDot[];
  primaryDots: SharedDot[];
  secondaryDots: SharedDot[];
  decorativeShared: DecorativeDot[];
  decorativePrimary: DecorativeDot[];
  decorativeSecondary: DecorativeDot[];
  referencePanelMin: number;
}

export function createDotModel(project: ProjectState, panels: CanvasPanel[]): DotModel {
  if (panels.length === 0) {
    return {
      sharedDots: [],
      primaryDots: [],
      secondaryDots: [],
      decorativeShared: [],
      decorativePrimary: [],
      decorativeSecondary: [],
      referencePanelMin: 1
    };
  }

  const referencePanelMin = Math.max(
    1,
    Math.min(...panels.map((panel) => Math.min(panel.rect.width, panel.rect.height)))
  );
  const dotDistanceRatio = Math.max(0.02, (project.dots.dotSize * 0.72) / referencePanelMin);
  const decorativeDistanceRatio = Math.max(0.02, (project.dots.dotSize * 0.82) / referencePanelMin);

  if (project.dots.distribution !== "random") {
    return {
      sharedDots: project.dotPlacements.shared,
      primaryDots: project.dotPlacements.primary,
      secondaryDots: project.dotPlacements.secondary,
      decorativeShared: [],
      decorativePrimary: [],
      decorativeSecondary: [],
      referencePanelMin
    };
  }

  const sharedDots = buildDotSet(project.dots.dotCount, project.dots.seed, dotDistanceRatio);
  const primaryDots = buildDotSet(project.dots.dotCount, project.dots.seed + 31, dotDistanceRatio);
  const secondaryDots = buildDotSet(project.dots.dotCount, project.dots.seed + 67, dotDistanceRatio);
  const decorativeShared = buildDecorativeSet(project.dots.decorativeCount, project.dots.seed + 97, decorativeDistanceRatio);
  const decorativePrimary = buildDecorativeSet(project.dots.decorativeCount, project.dots.seed + 127, decorativeDistanceRatio);
  const decorativeSecondary = buildDecorativeSet(project.dots.decorativeCount, project.dots.seed + 151, decorativeDistanceRatio);

  return {
    sharedDots,
    primaryDots,
    secondaryDots,
    decorativeShared,
    decorativePrimary,
    decorativeSecondary,
    referencePanelMin
  };
}

export function projectDot(
  dot: Pick<SharedDot, "xRatio" | "yRatio">,
  rect: Rect
) {
  return {
    x: rect.x + dot.xRatio * rect.width,
    y: rect.y + dot.yRatio * rect.height
  };
}

export function projectDotToLocalPoint(
  dot: Pick<SharedDot, "xRatio" | "yRatio">,
  width: number,
  height: number
) {
  return {
    x: dot.xRatio * width,
    y: dot.yRatio * height
  };
}

function buildDotSet(count: number, seed: number, minDistanceRatio: number): SharedDot[] {
  const rng = mulberry32(seed);
  return createNormalizedScatter(count, rng, minDistanceRatio, true).map((dot, index) => ({
    ...dot,
    id: `shared-${index}`
  }));
}

function buildDecorativeSet(count: number, seed: number, minDistanceRatio: number): DecorativeDot[] {
  const rng = mulberry32(seed);
  return createNormalizedScatter(count, rng, minDistanceRatio, false) as DecorativeDot[];
}

function createNormalizedScatter(
  count: number,
  rng: () => number,
  minDistanceRatio: number,
  includeIds: boolean
) {
  if (count <= 0) {
    return [];
  }

  const dots: Array<ReturnType<typeof buildDotRecord>> = [];
  const minDistanceSq = minDistanceRatio * minDistanceRatio;
  const attempts = Math.max(140, count * 180);

  for (let attempt = 0; attempt < attempts && dots.length < count; attempt += 1) {
    const xRatio = clamp(rng(), 0.05, 0.95);
    const yRatio = clamp(rng(), 0.05, 0.95);
    if (
      dots.every(
        (dot) =>
          distanceSquared(dot.xRatio, dot.yRatio, xRatio, yRatio) >= minDistanceSq
      )
    ) {
      dots.push(buildDotRecord(xRatio, yRatio, rng, includeIds ? dots.length : undefined));
    }
  }

  while (dots.length < count) {
    dots.push(
      buildDotRecord(
        clamp(rng(), 0.05, 0.95),
        clamp(rng(), 0.05, 0.95),
        rng,
        includeIds ? dots.length : undefined
      )
    );
  }

  return dots;
}

function buildDotRecord(
  xRatio: number,
  yRatio: number,
  rng: () => number,
  index?: number
) {
  return {
    ...(typeof index === "number" ? { id: `shared-${index}` } : {}),
    xRatio,
    yRatio,
    profileSample: rng(),
    varianceSample: rng(),
    rotationSeed: rng()
  };
}

function distanceSquared(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
