import test from "node:test";
import assert from "node:assert/strict";

import { extractPaletteFromImageData } from "../src/render/palette.ts";

test("extractPaletteFromImageData returns up to six weighted hex colors", () => {
  const rgba = new Uint8ClampedArray([
    240, 10, 20, 255,
    240, 12, 18, 255,
    10, 180, 220, 255,
    12, 176, 218, 255,
    248, 236, 92, 255,
    246, 232, 88, 255,
    32, 34, 36, 255,
    30, 32, 34, 255
  ]);

  const palette = extractPaletteFromImageData(rgba, 6);

  assert.ok(palette.length >= 3);
  assert.ok(palette.length <= 6);
  assert.ok(palette.every((color) => /^#[0-9a-f]{6}$/i.test(color.hex)));
  assert.ok(palette.every((color) => color.weight > 0));
});
