import test from "node:test";
import assert from "node:assert/strict";

import { createRandomSeed } from "../src/render/dotSeed.ts";

test("createRandomSeed returns a positive integer seed", () => {
  const originalRandom = Math.random;
  Math.random = () => 0.123456;

  try {
    const seed = createRandomSeed();
    assert.equal(Number.isInteger(seed), true);
    assert.equal(seed > 0, true);
    assert.equal(seed < 0x7fffffff, true);
  } finally {
    Math.random = originalRandom;
  }
});

test("createRandomSeed avoids returning the previous seed when collision happens", () => {
  const originalRandom = Math.random;
  Math.random = () => 42 / 0x7fffffff;

  try {
    const seed = createRandomSeed(42);
    assert.notEqual(seed, 42);
    assert.equal(seed, 43);
  } finally {
    Math.random = originalRandom;
  }
});
