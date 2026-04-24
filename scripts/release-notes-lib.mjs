export function classifyReleaseNoteCategory(subject) {
  return /\b(add|adds|added|implement|implements|implemented|new|introduce|introduces)\b/i.test(subject)
    ? "新增"
    : "修改";
}

export function normalizeReleaseNoteEntry(entry) {
  return {
    sha: entry.sha,
    shortSha: entry.shortSha,
    subject: entry.subject,
    date: entry.date,
    category: classifyReleaseNoteCategory(entry.subject)
  };
}
