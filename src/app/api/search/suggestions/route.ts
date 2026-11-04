import { z } from "zod";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import { listDiscoverableStores } from "@/server/marketplace/public-stores";
export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  const query = z.string().trim().min(2).max(120).safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!query.success) return Response.json({ products: [], stores: [] });
  try {
    const [products, stores] = await Promise.all([
      listDiscoverableProducts({ q: query.data, limit: 6 }),
      listDiscoverableStores({ q: query.data, limit: 4 })
    ]);
    return Response.json({
      products: products.items.map((item) => ({ id: item.id, name: item.name, slug: item.slug, storeName: item.store.name })),
      stores: stores.items.map((item) => ({ id: item.id, name: item.name, slug: item.slug }))
    }, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" } });
  } catch {
    return Response.json({ error: "Search suggestions are temporarily unavailable." }, { status: 500 });
  }
}
