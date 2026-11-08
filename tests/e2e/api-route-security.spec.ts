import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API_ROOT = path.join(process.cwd(), "src/app/api");
const sessions = JSON.parse(fs.readFileSync(".e2e-sessions.json", "utf8")) as Record<string, string>;
const PUBLIC_GETS = new Set([
  "brands/route.ts",
  "categories/route.ts",
  "countries/route.ts",
  "currencies/route.ts",
  "markets/route.ts",
  "search/route.ts",
  "search/suggestions/route.ts",
  "recommendations/route.ts",
  "payments/providers/route.ts",
  "stores/route.ts",
  "advertising/sponsored/route.ts"
]);

const PROTECTED_PREFIXES = [
  "account/",
  "admin/",
  "seller/",
  "favorites/",
  "messages/",
  "notifications/",
  "orders/",
  "returns/",
  "support/",
  "stores/staff-invitations/",
  "stores/staff-memberships/",
  "stores/[storeId]/staff/",
  "stores/[storeId]/messages/"
];

type RouteProbe = { file: string; method: string; url: string };

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : entry.name === "route.ts" ? [absolute] : [];
  });
}

function urlForRoute(file: string): string {
  const relative = path.relative(API_ROOT, file).split(path.sep).join("/");
  const route = relative
    .replace(/\/route\.ts$/, "")
    .replace(/\[\.\.\.([^\]]+)\]/g, "e2e-catch-all")
    .replace(/\[([^\]]+)\]/g, "cm000000000000000000000000");
  return `/api/${route}`;
}

function shouldProbe(relative: string, method: string): boolean {
  if (relative.startsWith("auth/") || relative.startsWith("cart/") || relative.startsWith("checkout/")) return false;
  if (relative === "ai/chat/route.ts") return false;

  if (relative === "locale/route.ts") return method !== "GET";
  if (relative === "advertising/events/route.ts") return false;
  if (relative.startsWith("cron/") || relative.startsWith("webhooks/")) return true;
  if (PUBLIC_GETS.has(relative) && method === "GET") return false;
  if (PROTECTED_PREFIXES.some((prefix) => relative.startsWith(prefix))) return true;

  if (relative.startsWith("products/")) return method !== "GET";
  if (relative.startsWith("questions/")) return method !== "GET";
  if (relative === "stores/[storeId]/reviews/route.ts") return method !== "GET";
  if (relative === "stores/[storeId]/reviews/[reviewId]/reports/route.ts") return true;

  return false;
}

const probes: RouteProbe[] = walk(API_ROOT).flatMap((file) => {
  const relative = path.relative(API_ROOT, file).split(path.sep).join("/");
  const source = fs.readFileSync(file, "utf8");
  const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)]
    .map((match) => match[1]);
  return [...new Set(methods)]
    .filter((method) => shouldProbe(relative, method))
    .map((method) => ({ file: relative, method, url: urlForRoute(file) }));
});

test.describe("API route unauthenticated security boundary", () => {
  test("rejects anonymous access across every protected route method", async ({ request }) => {
    test.setTimeout(180_000);
    expect(probes.length, "The API security sweep must discover protected routes.").toBeGreaterThan(0);

    const allowedDenialStatuses = new Set([400, 401, 403, 404, 405, 409, 410, 422, 429]);
    const failures: Array<{ method: string; url: string; status: number; body: string }> = [];

    for (const probe of probes) {
      const response = await request.fetch(probe.url, {
        method: probe.method,
        headers: {
          // Exercise the same trusted-edge and same-origin boundaries as the browser.
          "cf-connecting-ip": "203.0.113.10",
          "Origin": "http://127.0.0.1:3000",
          ...(probe.method === "GET" ? {} : { "Content-Type": "application/json" })
        },
        ...(probe.method === "GET" ? {} : { data: {} })
      });
      if (!allowedDenialStatuses.has(response.status())) {
        failures.push({
          method: probe.method,
          url: probe.url,
          status: response.status(),
          body: (await response.text()).slice(0, 240)
        });
      }
    }

    expect(
      failures,
      `Anonymous requests must not succeed. Probed ${probes.length} route/method pairs. Failures: ${JSON.stringify(failures, null, 2)}`
    ).toEqual([]);
  });
});


test.describe("API role authorization boundary", () => {
  test("buyers and sellers cannot read protected platform data or another role's resources", async ({ request }) => {
    const probes = [
      { actor: "buyer", token: sessions.buyer, method: "GET", url: "/api/admin/users" },
      { actor: "buyer", token: sessions.buyer, method: "GET", url: "/api/admin/dashboard" },
      { actor: "buyer", token: sessions.buyer, method: "GET", url: "/api/admin/sellers" },
      { actor: "buyer", token: sessions.buyer, method: "GET", url: "/api/seller/stores" },
      { actor: "buyer", token: sessions.buyer, method: "GET", url: "/api/seller/orders" },
      { actor: "seller", token: sessions.seller, method: "GET", url: "/api/admin/users" },
      { actor: "seller", token: sessions.seller, method: "GET", url: "/api/admin/dashboard" }
    ];
    const allowedDenialStatuses = new Set([401, 403, 404]);
    const failures: Array<{ actor: string; url: string; status: number; body: string }> = [];

    for (const probe of probes) {
      const response = await request.fetch(probe.url, {
        method: probe.method,
        headers: {
          Cookie: "mtjr2_session=" + probe.token,
          "cf-connecting-ip": "203.0.113.10",
          "Cache-Control": "no-store"
        }
      });
      const body = await response.text();
      let payload: Record<string, unknown> | null = null;
      try { payload = JSON.parse(body) as Record<string, unknown>; } catch { /* Keep the raw response for the failure report. */ }
      if (response.status() === 200 && probe.actor === "buyer" && payload) {
        const safeEmptySellerWorkspace =
          probe.url === "/api/seller/stores" &&
          payload.seller === null &&
          Array.isArray(payload.stores) &&
          payload.stores.length === 0;
        const safeEmptySellerOrders =
          probe.url === "/api/seller/orders" &&
          Array.isArray(payload.orders) &&
          payload.orders.length === 0;
        if (safeEmptySellerWorkspace || safeEmptySellerOrders) continue;
      }
      if (!allowedDenialStatuses.has(response.status())) {
        failures.push({
          actor: probe.actor,
          url: probe.url,
          status: response.status(),
          body: body.slice(0, 240)
        });
      }
    }

    expect(failures, "A buyer or seller must not cross into another role's API boundary.").toEqual([]);
  });
});
