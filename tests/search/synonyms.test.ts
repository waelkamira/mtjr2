import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    searchSynonym: { findMany: mocks.findMany },
    $transaction: mocks.transaction
  }
}));

import { createSearchSynonym, deleteSearchSynonym, listSearchSynonyms, updateSearchSynonym } from "@/server/search/synonyms";

describe("admin search synonyms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.findMany.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue(null);
    mocks.findUnique.mockResolvedValue({ id: "syn-1", locale: "en", term: "sneaker", synonym: "trainer", isActive: true });
    mocks.create.mockResolvedValue({ id: "syn-1", locale: "en", term: "sneaker", synonym: "trainer", isActive: true });
    mocks.update.mockResolvedValue({ id: "syn-1", locale: "en", term: "sneaker", synonym: "trainer", isActive: false });
    mocks.delete.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      searchSynonym: {
        findFirst: mocks.findFirst,
        findUnique: mocks.findUnique,
        create: mocks.create,
        update: mocks.update,
        delete: mocks.delete
      },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("requires platform management permission for reads", async () => {
    await listSearchSynonyms();
    expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "users:manage" });
    expect(mocks.findMany).toHaveBeenCalledOnce();
  });

  it("creates normalized synonym mappings and audits the change", async () => {
    await createSearchSynonym({ locale: "en", term: "Sneaker", synonym: "Trainer" }, new Date("2026-01-01T00:00:00.000Z"));
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ locale: "en", term: "sneaker", synonym: "trainer", isActive: true });
    expect(mocks.auditCreate.mock.calls[0][0].data).toMatchObject({
      actorId: "admin-1", action: "search.synonym.created", resourceId: "syn-1"
    });
  });

  it("rejects duplicate mappings and self-synonyms", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "existing" });
    await expect(createSearchSynonym({ locale: "en", term: "Sneaker", synonym: "Trainer" })).rejects.toThrow(/already exists/i);
    await expect(createSearchSynonym({ locale: "en", term: "Sneaker", synonym: "sneaker" })).rejects.toThrow();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("activates and deletes existing mappings with audit events", async () => {
    const updated = await updateSearchSynonym("syn-1", { isActive: false });
    expect(updated.isActive).toBe(false);
    expect(mocks.auditCreate.mock.calls[0][0].data.action).toBe("search.synonym.deactivated");
    await deleteSearchSynonym("syn-1");
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "syn-1" } });
    expect(mocks.auditCreate.mock.calls[1][0].data.action).toBe("search.synonym.deleted");
  });
});
