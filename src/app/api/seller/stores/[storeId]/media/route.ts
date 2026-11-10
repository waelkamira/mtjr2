import { AuditActorType, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { AuthenticationRequiredError, requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { deleteProductImage } from "@/server/media/product-image-deletion";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ storeId: string }> };

class StoreMediaError extends Error {
  constructor(readonly code: "STORE_NOT_FOUND" | "ASSET_NOT_FOUND" | "ASSET_IN_USE" | "DELETE_UNAVAILABLE") {
    super(code);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const actor = await requireCurrentSession();
    const { storeId } = await context.params;
    const parsed = z.object({ assetId: z.string().trim().min(1).max(128) }).strict().safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "A valid media asset is required." }, { status: 400 });

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, status: true, logoUrl: true, bannerUrl: true, logoStorageKey: true, bannerStorageKey: true, seller: { select: { ownerId: true, status: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || (store.status !== StoreStatus.ACTIVE && store.status !== StoreStatus.DRAFT)) {
      throw new StoreMediaError("STORE_NOT_FOUND");
    }
    if (store.seller.ownerId !== actor.userId) {
      const [scoped, platformAdmin] = await Promise.all([
        userHasScopedPermission(actor.userId, { permissionKey: "catalog:manage", scope: { type: "STORE", id: storeId } }),
        userHasPermission(actor.userId, { permissionKey: "users:manage" })
      ]);
      if (!scoped && !platformAdmin) throw new PermissionDeniedError();
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`;
      const asset = await tx.storeMediaAsset.findFirst({
        where: { id: parsed.data.assetId, storeId },
        select: { id: true, url: true, storageKey: true }
      });
      if (!asset) throw new StoreMediaError("ASSET_NOT_FOUND");
      if (!asset.storageKey) throw new StoreMediaError("DELETE_UNAVAILABLE");

      const current = await tx.store.findUnique({
        where: { id: storeId },
        select: { logoUrl: true, bannerUrl: true, logoStorageKey: true, bannerStorageKey: true }
      });
      if (current && (
        current.logoStorageKey === asset.storageKey || current.bannerStorageKey === asset.storageKey ||
        current.logoUrl === asset.url || current.bannerUrl === asset.url
      )) throw new StoreMediaError("ASSET_IN_USE");

      const attachedProductMedia = await tx.productMedia.findFirst({ where: { storageKey: asset.storageKey }, select: { id: true } });
      if (attachedProductMedia) throw new StoreMediaError("ASSET_IN_USE");

      const deleted = await deleteProductImage(asset.storageKey);
      if (deleted !== "deleted") throw new StoreMediaError("DELETE_UNAVAILABLE");

      await tx.storeMediaAsset.delete({ where: { id: asset.id } });
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: actor.userId,
          action: "store.media_asset_deleted",
          resource: "store_media_asset",
          resourceId: asset.id,
          scopeType: "STORE",
          scopeId: storeId,
          metadata: { provider: asset.storageKey.split(":")[0] }
        }
      });
      return { deleted: true };
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof StoreMediaError) {
      const status = error.code === "STORE_NOT_FOUND" || error.code === "ASSET_NOT_FOUND" ? 404
        : error.code === "ASSET_IN_USE" ? 409 : 503;
      const message = error.code === "STORE_NOT_FOUND" ? "Store not found."
        : error.code === "ASSET_NOT_FOUND" ? "Media asset not found in this store."
        : error.code === "ASSET_IN_USE" ? "This asset is still used by store branding or a product."
        : "Provider deletion is unavailable for this asset. It remains in the media library.";
      return Response.json({ error: message, code: error.code }, { status });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid media deletion request." }, { status: 400 });
    return Response.json({ error: "Unable to delete store media." }, { status: 500 });
  }
}
