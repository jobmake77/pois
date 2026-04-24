import test from "node:test";
import assert from "node:assert/strict";

import { defaultBase, defaultDots, defaultLayout, themePresets } from "../src/presets.ts";
import { createAnimationProject, getAnimationDotCount } from "../src/render/dotAnimation.ts";
import { normalizeDotPlacements } from "../src/render/dotEditing.ts";
import type { ProjectState } from "../src/types.ts";

function createProject(): ProjectState {
  return {
    id: "project-test",
    themeId: themePresets[0].id,
    photoIds: ["photo-1"],
    fillPhotoId: "photo-1",
    activePhotoId: "photo-1",
    photoCrops: {},
    dotPlacements: normalizeDotPlacements({
      primary: [
        { id: "manual-1", xRatio: 0.1, yRatio: 0.2, profileSample: 0.1, varianceSample: 0.2, rotationSeed: 0.3 },
        { id: "manual-2", xRatio: 0.2, yRatio: 0.3, profileSample: 0.2, varianceSample: 0.3, rotationSeed: 0.4 }
      ],
      secondary: [
        { id: "manual-3", xRatio: 0.3, yRatio: 0.4, profileSample: 0.3, varianceSample: 0.4, rotationSeed: 0.5 }
      ],
      strokes: [
        { id: "stroke-1", bucket: "primary", dotIds: ["manual-1", "manual-2"] },
        { id: "stroke-2", bucket: "secondary", dotIds: ["manual-3"] }
      ],
      nextId: 4,
      nextStrokeId: 3
    }),
    layoutMode: "single",
    panelDirection: "horizontal",
    primaryShare: 0.5,
    pairedDotsMode: "auto",
    fillBlockEnabled: true,
    fillBlockDotsEnabled: true,
    layout: defaultLayout,
    base: defaultBase,
    dots: {
      ...defaultDots,
      distribution: "single-side"
    },
    canvasWidth: 1000,
    canvasHeight: 1280,
    exportFormat: "png"
  };
}

test("getAnimationDotCount reads manual stroke order", () => {
  const project = createProject();
  assert.equal(getAnimationDotCount(project), 3);
});

test("createAnimationProject keeps only visible manual dots", () => {
  const project = createProject();
  const visible = createAnimationProject(project, 2);

  assert.equal(visible.dotPlacements.primary.length, 2);
  assert.equal(visible.dotPlacements.secondary.length, 0);
  assert.equal(visible.dotPlacements.strokes.length, 1);
  assert.deepEqual(visible.dotPlacements.strokes[0].dotIds, ["manual-1", "manual-2"]);
});

test("createAnimationProject clamps random dot counts", () => {
  const project = {
    ...createProject(),
    dots: {
      ...createProject().dots,
      distribution: "random" as const,
      dotCount: 10,
      decorativeCount: 4
    }
  };

  const visible = createAnimationProject(project, 3);
  assert.equal(visible.dots.dotCount, 3);
  assert.equal(visible.dots.decorativeCount, 3);
});
