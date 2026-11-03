import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    loginRateLimitBucket: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn()
    }
  };

  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      loginRateLimitBucket: { updateMany: vi.fn() }
    }
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  clearIdentifierLoginThrottle,
  consumeLoginAttempt
} from "../../src/server/identity/login-throttle";

const now = new Date("2026-11-03T12:00:00.000Z");

describe("persistent login throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      (callback: (client: typeof txMock) => unknown) => callback(txMock)
    );
    txMock.loginRateLimitBucket.upsert.mockImplementation(
      async ({ where, create }) => ({
        keyHash: where.keyHash,
        windowStartedAt: create.windowStartedAt,
        attemptCount: 1,
        blockedUntil: null
      })
    );
    txMock.loginRateLimitBucket.updateMany.mockResolvedValue({ count: 0 });
    txMock.loginRateLimitBucket.findUnique.mockImplementation(
      async ({ where }) => ({
        keyHash: where.keyHash,
        windowStartedAt: now,
        attemptCount: 1,
        blockedUntil: null
      })
    );
  });

  it("normalizes the identifier and stores only keyed digests", async () => {
    await expect(consumeLoginAttempt({
      identifier: " Buyer@Example.COM ",
      trustedIpAddress: "203.0.113.8"
    }, now)).resolves.toEqual({ blocked: false });

    const calls = txMock.loginRateLimitBucket.upsert.mock.calls;
    expect(calls).toHaveLength(2);
    for (const [args] of calls) {
      expect(args.where.keyHash).toMatch(/^[a-f0-9]{64}$/);
      expect(args.where.keyHash).not.toContain("buyer@example.com");
      expect(args.where.keyHash).not.toContain("203.0.113.8");
    }
  });

  it("clears only the normalized identifier bucket after successful authentication", async () => {
    txMock.loginRateLimitBucket.updateMany.mockResolvedValue({ count: 1 });

    await clearIdentifierLoginThrottle(" Buyer@Example.COM ");

    expect(txMock.loginRateLimitBucket.updateMany).toHaveBeenCalledWith({
      where: { keyHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
      data: {
        windowStartedAt: expect.any(Date),
        attemptCount: 0,
        blockedUntil: null
      }
    });
  });

  it("rejects an empty or oversized identifier before database access", async () => {
    await expect(consumeLoginAttempt({ identifier: "  " }, now)).rejects.toThrow(
      /valid login identifier/
    );
    await expect(consumeLoginAttempt({ identifier: "x".repeat(255) }, now)).rejects.toThrow(
      /valid login identifier/
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks when the identifier bucket reaches its configured threshold", async () => {
    txMock.loginRateLimitBucket.upsert.mockResolvedValue({
      keyHash: "a".repeat(64),
      windowStartedAt: now,
      attemptCount: 5,
      blockedUntil: null
    });
    txMock.loginRateLimitBucket.findUnique.mockResolvedValue({
      keyHash: "a".repeat(64),
      windowStartedAt: now,
      attemptCount: 5,
      blockedUntil: new Date(now.getTime() + 15 * 60 * 1000)
    });

    await expect(consumeLoginAttempt({ identifier: "buyer@example.com" }, now))
      .resolves.toEqual({ blocked: true });

    expect(txMock.loginRateLimitBucket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          keyHash: "a".repeat(64),
          attemptCount: { gte: 5 }
        }),
        data: expect.objectContaining({
          blockedUntil: new Date(now.getTime() + 15 * 60 * 1000)
        })
      })
    );
  });

  it("resets an expired window using a conditional database update", async () => {
    txMock.loginRateLimitBucket.upsert.mockResolvedValue({
      keyHash: "b".repeat(64),
      windowStartedAt: new Date(now.getTime() - 16 * 60 * 1000),
      attemptCount: 12,
      blockedUntil: null
    });
    txMock.loginRateLimitBucket.findUnique.mockResolvedValue({
      keyHash: "b".repeat(64),
      windowStartedAt: now,
      attemptCount: 1,
      blockedUntil: null
    });

    await expect(consumeLoginAttempt({ identifier: "buyer@example.com" }, now))
      .resolves.toEqual({ blocked: false });

    expect(txMock.loginRateLimitBucket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          keyHash: "b".repeat(64),
          OR: expect.any(Array)
        }),
        data: {
          windowStartedAt: now,
          attemptCount: 1,
          blockedUntil: null
        }
      })
    );
  });
});
