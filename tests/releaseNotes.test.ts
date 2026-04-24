import test from "node:test";
import assert from "node:assert/strict";

test("release note category marks additive subjects as 新增", async () => {
  const { classifyReleaseNoteCategory } = await import("../scripts/release-notes-lib.mjs");
  assert.equal(classifyReleaseNoteCategory("Add mosaic animation export"), "新增");
});

test("release note category marks generic fixes as 修改", async () => {
  const { normalizeReleaseNoteEntry } = await import("../scripts/release-notes-lib.mjs");
  const entry = normalizeReleaseNoteEntry({
    sha: "abc",
    shortSha: "abc",
    subject: "Fix preview layout",
    date: "2026-04-24"
  });

  assert.equal(entry.category, "修改");
  assert.equal(entry.shortSha, "abc");
});
