import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock, sessionMock } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    country: { findFirst: vi.fn() },
    userAddress: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() }
  };
  return {
    txMock: tx,
    prismaMock: {
      userAddress: { findMany: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    },
    sessionMock: { requireCurrentSession: vi.fn() }
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/identity/current-session", () => ({
  requireCurrentSession: sessionMock.requireCurrentSession
}));

import { createUserAddress, deleteUserAddress, listUserAddresses, setDefaultUserAddress, updateUserAddress } from "../../src/server/account/addresses";

const savedAddress = {
  id: "address-1",
  userId: "buyer-1",
  countryId: "country-1",
  label: null,
  recipientName: "Buyer Person",
  phone: "+33612345678",
  line1: "1 Rue de Rivoli",
  line2: null,
  city: "Paris",
  region: null,
  postalCode: null,
  isDefault: true,
  createdAt: new Date("2026-11-04T10:00:00.000Z"),
  updatedAt: new Date("2026-11-04T10:00:00.000Z"),
  country: { iso2: "FR", name: "France" }
};

describe("customer address API data contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.requireCurrentSession.mockResolvedValue({ userId: "buyer-1" });
    prismaMock.$transaction.mockImplementation(
      (callback: (client: typeof txMock) => unknown) => callback(txMock)
    );
  });

  it("returns the flattened countryCode/countryName shape for the current user only", async () => {
    prismaMock.userAddress.findMany.mockResolvedValue([savedAddress]);

    const addresses = await listUserAddresses();

    expect(prismaMock.userAddress.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "buyer-1" }
    }));
    expect(addresses[0]).toMatchObject({ countryCode: "FR", countryName: "France" });
    expect(addresses[0]).not.toHaveProperty("country");
  });

  it("accepts the iso2 countryCode returned by /api/countries and persists against the session owner", async () => {
    txMock.country.findFirst.mockResolvedValue({ id: "country-1", iso2: "FR", name: "France" });
    txMock.userAddress.findFirst.mockResolvedValue(null);
    txMock.userAddress.create.mockResolvedValue(savedAddress);

    const address = await createUserAddress({
      countryCode: "FR",
      recipientName: "Buyer Person",
      phone: "+33612345678",
      line1: "1 Rue de Rivoli",
      city: "Paris"
    });

    expect(txMock.country.findFirst).toHaveBeenCalledWith({
      where: { iso2: "FR", isActive: true },
      select: { id: true, iso2: true, name: true }
    });
    expect(txMock.userAddress.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "buyer-1",
        countryId: "country-1",
        isDefault: true
      })
    }));
    expect(address).toMatchObject({ countryCode: "FR", countryName: "France" });
  });
  it("updates only an address owned by the session user and atomically makes it default", async () => {
    txMock.userAddress.findFirst
      .mockResolvedValueOnce({ id: "address-1", isDefault: false })
      .mockResolvedValueOnce(savedAddress);
    txMock.country.findFirst.mockResolvedValue({ id: "country-1", iso2: "FR", name: "France" });
    txMock.userAddress.updateMany.mockResolvedValue({ count: 1 });

    const address = await updateUserAddress("address-1", {
      countryCode: "FR", recipientName: "Buyer Person", phone: "+33612345678",
      line1: "2 Rue de Rivoli", city: "Paris", isDefault: true
    });

    expect(txMock.$queryRaw).toHaveBeenCalledOnce();
    expect(txMock.userAddress.updateMany).toHaveBeenNthCalledWith(1, {
      where: { userId: "buyer-1", isDefault: true }, data: { isDefault: false }
    });
    expect(txMock.userAddress.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: "address-1", userId: "buyer-1" },
      data: expect.objectContaining({ line1: "2 Rue de Rivoli", isDefault: true })
    }));
    expect(address).toMatchObject({ countryCode: "FR", countryName: "France" });
  });

  it("does not reveal or mutate another user's address", async () => {
    txMock.userAddress.findFirst.mockResolvedValue(null);
    await expect(updateUserAddress("someone-elses-address", {
      countryCode: "FR", recipientName: "Buyer Person", phone: "+33612345678",
      line1: "2 Rue de Rivoli", city: "Paris"
    })).rejects.toThrow("Saved address not found.");
    expect(txMock.userAddress.updateMany).not.toHaveBeenCalled();
    expect(txMock.userAddress.deleteMany).not.toHaveBeenCalled();
  });

  it("sets the selected owned address as the only default", async () => {
    txMock.userAddress.findFirst.mockResolvedValue({ id: "address-2" });
    txMock.userAddress.updateMany.mockResolvedValue({ count: 1 });

    await expect(setDefaultUserAddress("address-2")).resolves.toEqual({ id: "address-2", isDefault: true });

    expect(txMock.userAddress.updateMany).toHaveBeenNthCalledWith(1, {
      where: { userId: "buyer-1", isDefault: true }, data: { isDefault: false }
    });
    expect(txMock.userAddress.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "address-2", userId: "buyer-1" }, data: { isDefault: true }
    });
  });

  it("promotes the newest remaining address when the default is deleted", async () => {
    txMock.userAddress.findFirst
      .mockResolvedValueOnce({ id: "address-1", isDefault: true })
      .mockResolvedValueOnce({ id: "address-2" });
    txMock.userAddress.deleteMany.mockResolvedValue({ count: 1 });
    txMock.userAddress.updateMany.mockResolvedValue({ count: 1 });

    await expect(deleteUserAddress("address-1")).resolves.toEqual({
      deleted: true, defaultAddressId: "address-2"
    });
    expect(txMock.userAddress.deleteMany).toHaveBeenCalledWith({
      where: { id: "address-1", userId: "buyer-1" }
    });
    expect(txMock.userAddress.updateMany).toHaveBeenCalledWith({
      where: { id: "address-2", userId: "buyer-1" }, data: { isDefault: true }
    });
  });

  it("does not delete an address that is not owned by the current user", async () => {
    txMock.userAddress.findFirst.mockResolvedValue(null);
    await expect(deleteUserAddress("foreign-address")).rejects.toThrow("Saved address not found.");
    expect(txMock.userAddress.deleteMany).not.toHaveBeenCalled();
  });

});
