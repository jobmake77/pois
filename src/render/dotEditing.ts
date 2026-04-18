import type {
  Distribution,
  DotPlacement,
  DotPlacementState,
  DotStroke
} from "../types";

type DotTarget = "primary" | "secondary";
type DotPoint = { xRatio: number; yRatio: number };
type DotBucket = DotStroke["bucket"];

export function createEmptyDotPlacements(): DotPlacementState {
  return {
    primary: [],
    secondary: [],
    shared: [],
    strokes: [],
    nextId: 1,
    nextStrokeId: 1
  };
}

export function normalizeDotPlacements(value?: Partial<DotPlacementState>): DotPlacementState {
  const nextId =
    typeof value?.nextId === "number" && Number.isFinite(value.nextId) && value.nextId > 0
      ? Math.floor(value.nextId)
      : 1;
  const nextStrokeId =
    typeof value?.nextStrokeId === "number" && Number.isFinite(value.nextStrokeId) && value.nextStrokeId > 0
      ? Math.floor(value.nextStrokeId)
      : 1;

  const primary = normalizeDotList(value?.primary);
  const secondary = normalizeDotList(value?.secondary);
  const shared = normalizeDotList(value?.shared);
  const retainedIds = new Set([...primary, ...secondary, ...shared].map((dot) => dot.id));

  return {
    primary,
    secondary,
    shared,
    strokes: normalizeStrokes(value?.strokes, retainedIds),
    nextId,
    nextStrokeId
  };
}

export function addDotStroke(
  current: DotPlacementState,
  distribution: Distribution,
  target: DotTarget,
  points: DotPoint[]
): DotPlacementState {
  if (distribution === "random" || points.length === 0) {
    return current;
  }

  const bucket: DotBucket = distribution === "double-side"
    ? "shared"
    : target === "secondary"
      ? "secondary"
      : "primary";
  const uniquePoints = dedupePoints(points);
  if (uniquePoints.length === 0) {
    return current;
  }

  const placements = uniquePoints.map((point, index) =>
    createDotPlacement(current.nextId + index, point.xRatio, point.yRatio, getSizeMultiplier())
  );
  const stroke: DotStroke = {
    id: `stroke-${current.nextStrokeId}`,
    bucket,
    dotIds: placements.map((item) => item.id)
  };

  return {
    ...current,
    [bucket]: [...current[bucket], ...placements],
    strokes: [...current.strokes, stroke],
    nextId: current.nextId + placements.length,
    nextStrokeId: current.nextStrokeId + 1
  };
}

export function undoLastDotStroke(current: DotPlacementState): DotPlacementState {
  const lastStroke = current.strokes[current.strokes.length - 1];
  if (!lastStroke) {
    return current;
  }

  const removed = new Set(lastStroke.dotIds);
  return {
    ...current,
    [lastStroke.bucket]: current[lastStroke.bucket].filter((dot) => !removed.has(dot.id)),
    strokes: current.strokes.slice(0, -1)
  };
}

export function clearDotPlacements(current: DotPlacementState): DotPlacementState {
  return {
    ...current,
    primary: [],
    secondary: [],
    shared: [],
    strokes: []
  };
}

export function getManualDotCount(current: DotPlacementState) {
  return current.primary.length + current.secondary.length + current.shared.length;
}

function normalizeDotList(value: Partial<DotPlacement>[] | undefined): DotPlacement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (
        typeof item?.xRatio !== "number" ||
        typeof item?.yRatio !== "number" ||
        typeof item?.profileSample !== "number" ||
        typeof item?.varianceSample !== "number" ||
        typeof item?.rotationSeed !== "number"
      ) {
        return null;
      }

      return {
        id: typeof item.id === "string" && item.id.length > 0 ? item.id : `manual-${index + 1}`,
        xRatio: clampRatio(item.xRatio),
        yRatio: clampRatio(item.yRatio),
        profileSample: clampUnit(item.profileSample),
        varianceSample: clampUnit(item.varianceSample),
        rotationSeed: clampUnit(item.rotationSeed),
        sizeMultiplier:
          typeof item.sizeMultiplier === "number" && Number.isFinite(item.sizeMultiplier)
            ? clampSizeMultiplier(item.sizeMultiplier)
            : undefined
      };
    })
    .filter(Boolean) as DotPlacement[];
}

function normalizeStrokes(value: Partial<DotStroke>[] | undefined, retainedIds: Set<string>): DotStroke[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (
        item?.bucket !== "primary" &&
        item?.bucket !== "secondary" &&
        item?.bucket !== "shared"
      ) {
        return null;
      }

      const dotIds = Array.isArray(item.dotIds)
        ? item.dotIds.filter((dotId): dotId is string => typeof dotId === "string" && retainedIds.has(dotId))
        : [];
      if (dotIds.length === 0) {
        return null;
      }

      return {
        id: typeof item.id === "string" && item.id.length > 0 ? item.id : `stroke-${index + 1}`,
        bucket: item.bucket,
        dotIds
      };
    })
    .filter(Boolean) as DotStroke[];
}

function createDotPlacement(
  nextId: number,
  xRatio: number,
  yRatio: number,
  sizeMultiplier: number
): DotPlacement {
  const seed = Math.imul(Math.floor(clampRatio(xRatio) * 10000) + nextId * 131, 2654435761)
    ^ Math.floor(clampRatio(yRatio) * 10000);
  const rng = mulberry32(seed >>> 0);

  return {
    id: `manual-${nextId}`,
    xRatio: clampRatio(xRatio),
    yRatio: clampRatio(yRatio),
    profileSample: rng(),
    varianceSample: rng(),
    rotationSeed: rng(),
    sizeMultiplier: clampSizeMultiplier(sizeMultiplier)
  };
}

function dedupePoints(points: DotPoint[]) {
  const deduped: DotPoint[] = [];
  const used = new Set<string>();

  points.forEach((point) => {
    const xRatio = clampRatio(point.xRatio);
    const yRatio = clampRatio(point.yRatio);
    const key = `${xRatio.toFixed(4)}:${yRatio.toFixed(4)}`;
    if (used.has(key)) {
      return;
    }
    used.add(key);
    deduped.push({ xRatio, yRatio });
  });

  return deduped;
}

function getSizeMultiplier() {
  return 1;
}

function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampSizeMultiplier(value: number) {
  return Math.min(1.35, Math.max(0.45, value));
}

function mulberry32(seed: number) {
  return () => {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
