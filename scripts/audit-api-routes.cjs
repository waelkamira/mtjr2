const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
const apiRoot = path.join(root, "src/app/api");
const publicReads = new Set([
  "brands/route.ts", "categories/route.ts", "countries/route.ts", "currencies/route.ts",
  "markets/route.ts", "search/route.ts", "search/suggestions/route.ts", "recommendations/route.ts",
  "payments/providers/route.ts", "stores/route.ts"
]);
const evidencePatterns = [
  /validateIdentityMutationRequest\\s*\\(/, /requireCurrentSession\\s*\\(/, /getCurrentSession\\s*\\(/,
  /requirePermission\\s*\\(/, /requireAnyPermission\\s*\\(/, /requirePlatformManagement\\s*\\(/,
  /userHasPermission\\s*\\(/, /userHasScopedPermission\\s*\\(/, /authorized\\s*\\(\\s*request/,
  /verifyWebhook\\s*\\(/, /processVerifiedPaymentEvent\\s*\\(/, /getSessionCookie\\s*\\(/,
  /guestToken/, /hashToken\\s*\\(/, /ownerWhere\\s*\\(/, /assert[A-Z]\\w*(?:Owner|Access|Scope)\\s*\\(/
];
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : entry.name === "route.ts" ? [file] : [];
  });
}
function collect(source, file, depth = 0, seen = new Set()) {
  if (depth > 4 || seen.has(file)) return "";
  seen.add(file);
  let result = source;
  for (const match of source.matchAll(/from\\s+["']@\\/(server\\/[^"']+)["']/g)) {
    const relative = match[1];
    const candidates = [path.join(root, "src", relative + ".ts"), path.join(root, "src", relative, "index.ts"), path.join(root, "src", relative + ".tsx")];
    const target = candidates.find((candidate) => fs.existsSync(candidate));
    if (target) result += "\\n" + collect(fs.readFileSync(target, "utf8"), target, depth + 1, seen);
  }
  return result;
}
const rows = walk(apiRoot).map((file) => {
  const relative = path.relative(apiRoot, file).split(path.sep).join("/");
  const source = fs.readFileSync(file, "utf8");
  const methods = [...source.matchAll(/export\\s+async\\s+function\\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((match) => match[1]);
  const allSource = collect(source, file);
  const evidence = evidencePatterns.filter((pattern) => pattern.test(allSource)).map((pattern) => pattern.source);
  const isPublicRead = methods.length > 0 && methods.every((method) => method === "GET") && publicReads.has(relative);
  const isPublicIdentity = relative.startsWith("auth/") && evidence.length > 0;
  const isCronOrWebhook = (relative.startsWith("cron/") || relative.startsWith("webhooks/")) && evidence.length > 0;
  const classification = isPublicRead ? "PUBLIC_READ_ALLOWLIST" : isPublicIdentity ? "IDENTITY_FLOW_GUARD" : isCronOrWebhook ? "SIGNED_SYSTEM_ENDPOINT" : evidence.length ? "SERVER_GUARD_EVIDENCE" : "REVIEW_REQUIRED";
  return { relative, methods: [...new Set(methods)].join(","), classification, evidence: evidence.slice(0, 6).join("; ") };
});
const unresolved = rows.filter((row) => row.classification === "REVIEW_REQUIRED");
const lines = [
  "# API route security inventory",
  "",
  `- Route handlers discovered: **${rows.length}**`,
  `- Routes with explicit/indirect guard evidence: **${rows.length - unresolved.length}**`,
  `- Public GET routes explicitly allowlisted: **${rows.filter((row) => row.classification === "PUBLIC_READ_ALLOWLIST").length}**`,
  `- Routes requiring manual review: **${unresolved.length}**`,
  "",
  "| Route | Methods | Classification | Guard evidence |",
  "|---|---|---|---|",
  ...rows.map((row) => `| \`${row.relative}\` | ${row.methods || "none"} | ${row.classification} | ${row.evidence.replace(/\\|/g, "\\|")} |`)
];
const report = lines.join("\\n") + "\\n";
fs.writeFileSync("api-route-security-report.md", report);
process.stdout.write(report);
