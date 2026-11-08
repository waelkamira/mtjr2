/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const apiRoot = path.join(root, "src/app/api");

// Public reads are intentionally reachable without a user session.
// Every addition must be reviewed and remain narrowly scoped.
const publicReads = new Set([
  "brands/route.ts", "categories/route.ts", "countries/route.ts", "currencies/route.ts",
  "markets/route.ts", "markets/[code]/route.ts", "search/route.ts", "search/suggestions/route.ts",
  "recommendations/route.ts", "payments/providers/route.ts", "stores/route.ts",
  "advertising/sponsored/route.ts", "categories/[categoryId]/attributes/route.ts",
  "geography/[level]/route.ts"
]);

const authorizationPatterns = [
  /requireCurrentSession\s*\(/, /getCurrentSession\s*\(/,
  /requirePermission\s*\(/, /requireAnyPermission\s*\(/, /requirePlatformManagement\s*\(/,
  /userHasPermission\s*\(/, /userHasScopedPermission\s*\(/,
  /assert[A-Z]\w*(?:Owner|Access|Scope|Permission|Membership|Seller|Store)\s*\(/,
  /ownerWhere\s*\(/, /session\??\.userId/, /currentSession\??\.userId/,
  /require[A-Z]\w*(?:Seller|Store|Owner|Member|Admin|Account)\s*\(/,
  /resolve[A-Z]\w*(?:Access|Ownership|Membership)\s*\(/
];
const guestTokenPatterns = [
  /guestToken/, /verifyGuest/, /validateGuest/, /requireGuest/, /hashToken\s*\(/
];
const identityPatterns = [
  /validateIdentityMutationRequest\s*\(/, /registrationChallenge/,
  /verifyTurnstile/, /verifyGoogleIdToken/, /code_challenge_method/,
  /mtjr_google_state/, /login\s*\(/
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : entry.name === "route.ts" ? [file] : [];
  });
}

function collect(source, file, depth = 0, seen = new Set()) {
  if (depth > 5 || seen.has(file)) return "";
  seen.add(file);
  let result = source;
  const imports = [
    ...[...source.matchAll(/from\s+["']@\/(server\/[^"']+)["']/g)].map((match) => path.join(root, "src", match[1])),
    ...[...source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)].map((match) => path.resolve(path.dirname(file), match[1]))
  ];
  for (const base of imports) {
    const candidates = [base + ".ts", path.join(base, "route.ts"), path.join(base, "index.ts"), base + ".tsx"];
    const target = candidates.find((candidate) => fs.existsSync(candidate));
    if (target) result += "\n" + collect(fs.readFileSync(target, "utf8"), target, depth + 1, seen);
  }
  return result;
}

const rows = walk(apiRoot).map((file) => {
  const relative = path.relative(apiRoot, file).split(path.sep).join("/");
  const source = fs.readFileSync(file, "utf8");
  const methods = [...new Set([...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((match) => match[1]))];
  const allSource = collect(source, file);
  const isPublicRead = methods.length > 0 && methods.every((method) => method === "GET") && publicReads.has(relative);
  const isIdentityFlow = relative.startsWith("auth/") && identityPatterns.some((pattern) => pattern.test(allSource));
  const isSystemEndpoint = (relative.startsWith("cron/") &&
    (/authorized\s*\(\s*request/.test(allSource) || (/CRON_SECRET/.test(source) && /authorization/.test(source)))) ||
    (relative.startsWith("webhooks/") && /verifyWebhook\s*\(/.test(allSource));
  const isPublicPreferenceMutation = relative === "locale/route.ts" && /validateIdentityMutationRequest\s*\(\s*request\s*\)/.test(allSource);
  const hasAuthorization = authorizationPatterns.some((pattern) => pattern.test(allSource));
  const hasGuestToken = guestTokenPatterns.some((pattern) => pattern.test(allSource));
  const isSignedAdEvent = relative === "advertising/events/route.ts" &&
    /recordSponsoredAdEvent\s*\(/.test(source) && /value\.token/.test(source) && /eventId/.test(source);

  let boundary = "REVIEW_REQUIRED";
  let evidence = [];
  if (isPublicRead) {
    boundary = "PUBLIC_READ_ALLOWLIST";
    evidence = ["explicit public GET allowlist"];
  } else if (isIdentityFlow) {
    boundary = "PUBLIC_IDENTITY_FLOW";
    evidence = identityPatterns.filter((pattern) => pattern.test(allSource)).map((pattern) => pattern.source);
  } else if (isSystemEndpoint) {
    boundary = "SIGNED_SYSTEM_ENDPOINT";
    evidence = ["signed cron/webhook verifier"];
  } else if (isPublicPreferenceMutation) {
    boundary = "PUBLIC_PREFERENCE_MUTATION_CSRF_GUARDED";
    evidence = ["same-origin JSON mutation guard"];
  } else if (isSignedAdEvent) {
    boundary = "SIGNED_PUBLIC_EVENT";
    evidence = ["signed advertising event token"];
  } else if (hasAuthorization) {
    boundary = "AUTHENTICATED_OR_AUTHORIZED";
    evidence = authorizationPatterns.filter((pattern) => pattern.test(allSource)).map((pattern) => pattern.source);
  } else if (hasGuestToken) {
    boundary = "TOKEN_SCOPED_GUEST_ACCESS";
    evidence = guestTokenPatterns.filter((pattern) => pattern.test(allSource)).map((pattern) => pattern.source);
  }

  return { route: relative, methods: methods.join(",") || "none", boundary, evidence: evidence.join("; ") };
});

const unresolved = rows.filter((row) => row.boundary === "REVIEW_REQUIRED");
const counts = new Map();
for (const row of rows) counts.set(row.boundary, (counts.get(row.boundary) || 0) + 1);
const lines = [
  "# API authorization boundary inventory",
  "",
  "- Route handlers discovered: **" + rows.length + "**",
  "- Routes with a classified access boundary: **" + (rows.length - unresolved.length) + "**",
  "- Routes requiring manual authorization review: **" + unresolved.length + "**",
  "- Scope: static import-trace classification; it does not replace actor, ownership, or cross-store behavioral tests.",
  "",
  ...[...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => "- " + name + ": **" + count + "**"),
  "",
  "| Route | Methods | Access boundary | Evidence |",
  "|---|---|---|---|",
  ...rows.map((row) => "| `" + row.route + "` | " + row.methods + " | " + row.boundary + " | " + row.evidence.replace(/\|/g, "\\|") + " |")
];
const report = lines.join("\n") + "\n";
fs.writeFileSync("api-authorization-boundary-report.md", report);
process.stdout.write(report);

if (unresolved.length > 0) {
  process.stderr.write("Unclassified API routes require explicit access-boundary review.\n");
  process.exitCode = 1;
}
