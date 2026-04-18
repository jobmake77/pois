import test from "node:test";
import assert from "node:assert/strict";

import { defaultBase, defaultDots, defaultLayout, themePresets } from "../src/presets.ts";
import { resolvePanels } from "../src/render/blockLayout.ts";
import { normalizeDotPlacements } from "../src/render/dotEditing.ts";
import type { PanelDirection, ProjectState, SourceAsset } from "../src/types.ts";

function createProject(panelDirection: PanelDirection): ProjectState {
  return {
    id: "project-test",
    themeId: themePresets[0].id,
    photoIds: ["photo-1"],
    fillPhotoId: "photo-1",
    activePhotoId: "photo-1",
    photoCrops: {},
    dotPlacements: normalizeDotPlacements(undefined),
    layoutMode: "single",
    panelDirection,
    primaryShare: 0.5,
    pairedDotsMode: "auto",
    fillBlockEnabled: true,
    fillBlockDotsEnabled: true,
    layout: {
      ...defaultLayout,
      padding: 0,
      gap: 0
    },
    base: defaultBase,
    dots: defaultDots,
    canvasWidth: 1,
    canvasHeight: 1,
    exportFormat: "png"
  };
}

function createSource(width: number, height: number): SourceAsset {
  return {
    id: "photo-1",
    name: "photo-1",
    file: {} as File,
    objectUrl: "",
    width,
    height,
    aspectRatio: width / height,
    image: {} as CanvasImageSource,
    dominantColor: "#000000"
  };
}

test("single photo horizontal split stays edge-aligned without a seam", () => {
  const panels = resolvePanels(
    {
      ...createProject("horizontal"),
      canvasWidth: 201,
      canvasHeight: 200
    },
    201,
    200,
    [createSource(201, 1000)]
  );

  assert.equal(panels.length, 2);
  assert.equal(panels[0].rect.x + panels[0].rect.width, panels[1].rect.x);
  assert.equal(panels[0].rect.height, panels[1].rect.height);
});

test("single photo vertical split stays edge-aligned without a seam", () => {
  const panels = resolvePanels(
    {
      ...createProject("vertical"),
      canvasWidth: 200,
      canvasHeight: 201
    },
    200,
    201,
    [createSource(1991, 1000)]
  );

  assert.equal(panels.length, 2);
  assert.equal(panels[0].rect.y + panels[0].rect.height, panels[1].rect.y);
  assert.equal(panels[0].rect.width, panels[1].rect.width);
});
