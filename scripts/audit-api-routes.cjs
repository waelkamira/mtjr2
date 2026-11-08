/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
const apiRoot = path.join(root, "src/app/api");
const publicReads = new Set([
  "brands/route.ts", "categories/route.ts", "countries/route.ts", "currencies/route.ts",
  "markets/route.ts", "search/route.ts", "search/suggestions/route.ts", "recommendations/route.ts",
  "payments/providers/route.ts", "stores/route.ts", "advertising/sponsored/route.ts", "markets/[code]/route.ts",
  "categories/[categoryId]/attributes/route.ts", "geography/[level]/route.ts"
]);
const evidencePatterns = [
  /validateIdentityMutationRequest\s*\(/, /requireCurrentSession\s*\(/, /getCurrentSession\s*\(/,
  /requirePermission\s*\(/, /requireAnyPermission\s*\(/, /requirePlatformManagement\s*\(/,
  /userHasPermission\s*\(/, /userHasScopedPermission\s*\(/, /authorized\s*\(\s*request/,
  /verifyWebhook\s*\(/, /processVerifiedPaymentEvent\s*\(/, /getSessionCookie\s*\(/,
  /guestToken/, /hashToken\s*\(/, /ownerWhere\s*\(/, /assert[A-Z]\w*(?:Owner|Access|Scope)\s*\(/
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
  for (const match of source.matchAll(/from\s+["']@\/(server\/[^"']+)["']/g)) {
    const relative = match[1];
    const candidates = [path.join(root, "src", relative + ".ts"), path.join(root, "src", relative, "index.ts"), path.join(root, "src", relative + ".tsx")];
    const target = candidates.find((candidate) => fs.existsSync(candidate));
    if (target) result += "\n" + collect(fs.readFileSync(target, "utf8"), target, depth + 1, seen);
  }
  return result;
}
const rows = walk(apiRoot).map((file) => {
  const relative = path.relative(apiRoot, file).split(path.sep).join("/");
  const source = fs.readFileSync(file, "utf8");
  const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((match) => match[1]);
  const allSource = collect(source, file);
  const evidence = evidencePatterns.filter((pattern) => pattern.test(allSource)).map((pattern) => pattern.source);
  const isPublicRead = methods.length > 0 && methods.every((method) => method === "GET") && publicReads.has(relative);
  const isPublicIdentity = relative.startsWith("auth/") && evidence.length > 0;
  const isOAuthStart = relative === "auth/google/start/route.ts" && /randomBytes|code_challenge_method|mtjr_google_state/.test(allSource);
  const isPublicPreferenceMutation = relative === "locale/route.ts" && allSource.includes("validateIdentityMutationRequest(");
  const isCronOrWebhook = (relative.startsWith("cron/") || relative.startsWith("webhooks/")) && evidence.length > 0;
  const hasMutationMethod = methods.some((method) => method !== "GET");
  const hasRequestBoundary = allSource.includes("validateIdentityMutationRequest(") ||
    (relative.startsWith("webhooks/") && allSource.includes("verifyWebhook(")) ||
    (relative.startsWith("cron/") && allSource.includes("authorized(request)"));
  const mutationBoundary = !hasMutationMethod ? "NOT_APPLICABLE" : hasRequestBoundary ? "PROTECTED" : "REVIEW_REQUIRED";
  const classification = isPublicRead ? "PUBLIC_READ_ALLOWLIST" : isPublicPreferenceMutation ? "PUBLIC_PREFERENCE_MUTATION_CSRF_GUARDED" : isOAuthStart ? "OAUTH_START_STATE_PKCE" : isPublicIdentity ? "IDENTITY_FLOW_GUARD" : isCronOrWebhook ? "SIGNED_SYSTEM_ENDPOINT" : evidence.length ? "SERVER_GUARD_EVIDENCE" : "REVIEW_REQUIRED";
  return { relative, methods: [...new Set(methods)].join(","), classification, mutationBoundary, evidence: evidence.slice(0, 6).join("; ") };
});
const unresolved = rows.filter((row) => row.classification === "REVIEW_REQUIRED" || row.mutationBoundary === "REVIEW_REQUIRED");
const mutations = rows.filter((row) => row.mutationBoundary !== "NOT_APPLICABLE");
const unguardedMutations = mutations.filter((row) => row.mutationBoundary === "REVIEW_REQUIRED");
const tick = String.fromCharCode(96);
const lines = [
  "# API route security inventory",
  "",
  "- Route handlers discovered: **" + rows.length + "**",
  "- Routes with explicit/indirect guard evidence: **" + (rows.length - unresolved.length) + "**",
  "- Public GET routes explicitly allowlisted: **" + rows.filter((row) => row.classification === "PUBLIC_READ_ALLOWLIST").length + "**",
  "- Routes requiring manual review (classification or mutation boundary): **" + unresolved.length + "**",
  "- State-changing routes discovered: **" + mutations.length + "**",
  "- State-changing routes with request/system boundary evidence: **" + (mutations.length - unguardedMutations.length) + "**",
  "- State-changing routes requiring review: **" + unguardedMutations.length + "**",
  "",
  "| Route | Methods | Classification | Mutation boundary | Guard evidence |",
  "|---|---|---|---|---|",
  ...rows.map((row) => "| " + tick + row.relative + tick + " | " + (row.methods || "none") + " | " + row.classification + " | " + row.mutationBoundary + " | " + row.evidence.replace(/\|/g, "\\|") + " |")
];
const report = lines.join("\n") + "\n";
fs.writeFileSync("api-route-security-report.md", report);
process.stdout.write(report);

if (unguardedMutations.length > 0) process.exitCode = 1;
