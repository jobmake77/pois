import test from "node:test";
import assert from "node:assert/strict";

import {
  addDotStroke,
  clearDotPlacements,
  createEmptyDotPlacements,
  normalizeDotPlacements,
  undoLastDotStroke
} from "../src/render/dotEditing.ts";

test("single-side stores a stroke only on the targeted panel", () => {
  const placements = addDotStroke(
    createEmptyDotPlacements(),
    "single-side",
    "secondary",
    [
      { xRatio: 0.34, yRatio: 0.62 },
      { xRatio: 0.42, yRatio: 0.68 }
    ]
  );

  assert.equal(placements.primary.length, 0);
  assert.equal(placements.secondary.length, 2);
  assert.equal(placements.shared.length, 0);
  assert.equal(placements.strokes.length, 1);
  assert.equal(placements.strokes[0].bucket, "secondary");
});

test("double-side stores one shared stroke", () => {
  const placements = addDotStroke(
    createEmptyDotPlacements(),
    "double-side",
    "primary",
    [
      { xRatio: 0.28, yRatio: 0.41 },
      { xRatio: 0.35, yRatio: 0.49 }
    ]
  );

  assert.equal(placements.primary.length, 0);
  assert.equal(placements.secondary.length, 0);
  assert.equal(placements.shared.length, 2);
  assert.equal(placements.strokes.length, 1);
  assert.equal(placements.strokes[0].bucket, "shared");
});

test("manual strokes always keep the same size multiplier", () => {
  const placements = addDotStroke(
    createEmptyDotPlacements(),
    "single-side",
    "primary",
    [
      { xRatio: 0.1, yRatio: 0.2 },
      { xRatio: 0.2, yRatio: 0.3 },
      { xRatio: 0.3, yRatio: 0.4 }
    ]
  );

  assert.equal(placements.primary.length, 3);
  assert.ok(placements.primary.every((dot) => dot.sizeMultiplier === 1));
});

test("undo removes only the latest stroke", () => {
  let placements = createEmptyDotPlacements();

  placements = addDotStroke(
    placements,
    "single-side",
    "primary",
    [{ xRatio: 0.1, yRatio: 0.2 }]
  );
  placements = addDotStroke(
    placements,
    "single-side",
    "primary",
    [{ xRatio: 0.2, yRatio: 0.3 }]
  );
  placements = undoLastDotStroke(placements);

  assert.equal(placements.primary.length, 1);
  assert.equal(placements.strokes.length, 1);
  assert.equal(placements.primary[0].xRatio, 0.1);
});

test("clear removes all manual placements and stroke history", () => {
  let placements = addDotStroke(
    createEmptyDotPlacements(),
    "double-side",
    "primary",
    [{ xRatio: 0.4, yRatio: 0.5 }]
  );

  placements = clearDotPlacements(placements);

  assert.equal(placements.primary.length, 0);
  assert.equal(placements.secondary.length, 0);
  assert.equal(placements.shared.length, 0);
  assert.equal(placements.strokes.length, 0);
});

test("normalizeDotPlacements repairs invalid values and strips malformed records", () => {
  const placements = normalizeDotPlacements({
    primary: [
      {
        id: "",
        xRatio: -1,
        yRatio: 2,
        profileSample: 4,
        varianceSample: -3,
        rotationSeed: 0.4,
        sizeMultiplier: 5
      },
      {
        id: "broken"
      }
    ],
    strokes: [
      {
        id: "stroke-1",
        bucket: "primary",
        dotIds: ["manual-1", "missing"]
      }
    ],
    nextId: -10,
    nextStrokeId: -6
  });

  assert.equal(placements.nextId, 1);
  assert.equal(placements.nextStrokeId, 1);
  assert.equal(placements.primary.length, 1);
  assert.equal(placements.primary[0].id, "manual-1");
  assert.equal(placements.primary[0].xRatio, 0);
  assert.equal(placements.primary[0].yRatio, 1);
  assert.equal(placements.primary[0].profileSample, 1);
  assert.equal(placements.primary[0].varianceSample, 0);
  assert.equal(placements.primary[0].sizeMultiplier, 1.35);
  assert.equal(placements.strokes.length, 1);
  assert.deepEqual(placements.strokes[0].dotIds, ["manual-1"]);
});
