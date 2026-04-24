import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeReleaseNoteEntry } from "./release-notes-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outputPath = join(projectRoot, "public", "release-notes.json");

try {
  mkdirSync(dirname(outputPath), { recursive: true });
  const notes = readGitHistory(projectRoot);
  writeFileSync(outputPath, JSON.stringify(notes, null, 2) + "\n", "utf8");
} catch (error) {
  if (existsSync(outputPath)) {
    const existing = readFileSync(outputPath, "utf8");
    writeFileSync(outputPath, existing, "utf8");
  } else {
    writeFileSync(outputPath, "[]\n", "utf8");
  }

  console.warn(
    error instanceof Error
      ? `[release-notes] fallback to existing snapshot: ${error.message}`
      : "[release-notes] fallback to existing snapshot"
  );
}

function readGitHistory(cwd) {
  const output = execFileSync(
    "git",
    [
      "log",
      "--max-count=24",
      "--date=short",
      "--pretty=format:%H%x1f%h%x1f%ad%x1f%s"
    ],
    {
      cwd,
      encoding: "utf8"
    }
  );

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, shortSha, date, subject] = line.split("\u001f");
      return normalizeReleaseNoteEntry({
        sha,
        shortSha,
        date,
        subject
      });
    });
}
