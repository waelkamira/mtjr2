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
  .map(({ file, source }) => ({
    file: file.split(path.sep).join("/"),
    successToast: /toast\.(?:success|message)\s*\(/.test(source),
    errorToast: /toast\.error\s*\(/.test(source),
    alertFallback: /role=["']alert["']|setError\s*\(/.test(source)
  }));
const incomplete = rows.filter((row) => !row.successToast || !row.errorToast);
const lines = [
  "# UI mutation feedback inventory",
  "",
  `- Mutation-bearing feature/component files detected: **${rows.length}**`,
  `- Files with both success and error Toast: **${rows.length - incomplete.length}**`,
  `- Files requiring review: **${incomplete.length}**`,
  "",
  "| File | Success Toast | Error Toast | Alert fallback |",
  "|---|---:|---:|---:|",
  ...rows.map((row) => `| \`${row.file}\` | ${row.successToast ? "yes" : "no"} | ${row.errorToast ? "yes" : "no"} | ${row.alertFallback ? "yes" : "no"} |`)
];
const report = lines.join("\n") + "\n";
fs.writeFileSync("ui-mutation-toast-report.md", report);
process.stdout.write(report);
