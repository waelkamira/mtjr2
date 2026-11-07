/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const roots = ["src/features", "src/components"];
const mutation = /fetch\s*\([\s\S]{0,500}?method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/;
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}
const files = roots.flatMap(walk);
const rows = files.map((file) => ({ file, source: fs.readFileSync(file, "utf8") }))
  .filter(({ source }) => mutation.test(source))
  .map(({ file, source }) => {
    const relative = file.split(path.sep).join("/");
    const delegated = relative === "src/components/locale-provider.tsx";
    const backgroundTelemetry = relative === "src/features/storefront/sponsored-product-card.tsx";
    const successFeedback = /toast\.(?:success|message)\s*\(|set[A-Z]\w*(?:Notice|Success|Complete|Message|Result|Messages)\s*\(|role=["']status["']|router\.(?:push|replace)\s*\(|window\.location\.(?:assign|replace)/.test(source);
    const errorFeedback = /toast\.error\s*\(|role=["']alert["']|setError\s*\(|throw new Error\s*\(/.test(source);
    const feedbackMode = delegated ? "DELEGATED_TO_CONSUMER" : backgroundTelemetry ? "BACKGROUND_TELEMETRY" : /setMessages\s*\(/.test(source) ? "IN_BAND_CONVERSATION" : "USER_ACTION";
    return { file: relative, feedbackMode, successFeedback: delegated || backgroundTelemetry || feedbackMode === "IN_BAND_CONVERSATION" || successFeedback, errorFeedback: delegated || backgroundTelemetry || feedbackMode === "IN_BAND_CONVERSATION" || errorFeedback };
  });
const incomplete = rows.filter((row) => !row.successFeedback || !row.errorFeedback);
const tick = String.fromCharCode(96);
const lines = [
  "# UI mutation feedback inventory",
  "",
  "- Mutation-bearing feature/component files detected: **" + rows.length + "**",
  "- Files with an appropriate success and error feedback path: **" + (rows.length - incomplete.length) + "**",
  "- Files requiring review: **" + incomplete.length + "**",
  "",
  "| File | Feedback mode | Success feedback | Error feedback |",
  "|---|---|---:|---:|",
  ...rows.map((row) => "| " + tick + row.file + tick + " | " + row.feedbackMode + " | " + (row.successFeedback ? "yes" : "no") + " | " + (row.errorFeedback ? "yes" : "no") + " |")
];
const report = lines.join(String.fromCharCode(10)) + String.fromCharCode(10);
fs.writeFileSync("ui-mutation-toast-report.md", report);
process.stdout.write(report);
